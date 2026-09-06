from unittest.mock import MagicMock, patch

from api._lib import emails

# PostgREST returns numeric columns as float -- fixtures mirror that so the
# €89.0 / €89.5 formatting bug (Important 5) stays covered.
ORDER = {"id": "o1", "ref_num": 241, "name": "Ana", "email": "ana@example.com",
         "address": "Javastraat 44", "delivery_day": "Monday",
         "subtotal": 85.0, "fee": 4.0, "total": 89.5, "notes": ""}
ITEMS = [{"pack_size": 10, "dish_name": "Cochinita", "qty": 1, "unit_price": 85.0}]


def test_sends_customer_and_admin_email(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com,clau@x.com")
    with patch.object(emails, "_send") as send:
        emails.send_order_emails(ORDER, ITEMS)
        assert send.call_count == 2
        first = send.call_args_list[0]
        assert first.kwargs["to"] == ["ana@example.com"]
        assert "#SD-241" in first.kwargs["subject"]
        assert "€89.50" in first.kwargs["text"]
        assert "€85.00" in first.kwargs["text"]
        second = send.call_args_list[1]
        assert set(second.kwargs["to"]) == {"maca@x.com", "clau@x.com"}
        assert "€89.50" in second.kwargs["text"]


def test_eur_formats_float_money_with_two_decimals():
    assert emails._eur(89.0) == "89.00"
    assert emails._eur(89.5) == "89.50"
    assert emails._eur(4) == "4.00"


def test_send_posts_brevo_payload(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    with patch.object(emails.httpx, "post") as post:
        post.return_value = MagicMock(status_code=201)
        emails._send(subject="Hi", text="Body", to=["a@b.c"])
        args, kwargs = post.call_args
        assert args[0] == "https://api.brevo.com/v3/smtp/email"
        assert kwargs["headers"]["api-key"] == "xkeysib-test"
        body = kwargs["json"]
        assert body["sender"]["email"] == "hola@sabordomingo.test"
        assert body["to"] == [{"email": "a@b.c"}]
        assert body["subject"] == "Hi"
        assert body["textContent"] == "Body"


def test_order_paid_hook_survives_email_failure(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com")
    from api._lib import webhook
    with patch.object(emails, "_send", side_effect=RuntimeError("boom")):
        webhook.on_order_paid(ORDER, ITEMS)  # must not raise


def test_order_email_html_branded_and_escaped(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com")
    sneaky = {**ORDER, "name": "<script>alert(1)</script>"}
    with patch.object(emails, "_send") as send:
        emails.send_order_emails(sneaky, ITEMS)
        html = send.call_args_list[0].kwargs["html"]
        assert "logo-white.png" in html
        assert "<script>" not in html
        assert "&lt;script&gt;" in html


def test_refund_email_full_vs_partial(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    with patch.object(emails, "_send") as send:
        emails.send_refund_email(ORDER, 89.5, full=True)
        kw = send.call_args.kwargs
        assert kw["to"] == ["ana@example.com"]
        assert "€89.50" in kw["subject"]
        assert "cancelled" in kw["text"]
        emails.send_refund_email(ORDER, 10, full=False)
        kw = send.call_args.kwargs
        assert "€10.00" in kw["text"]
        assert "stays as planned" in kw["text"]


def test_confirmation_uses_cook_date_not_hardcoded_monday(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com")
    order = {**ORDER, "cook_date": "2026-09-07", "delivery_day": "Wednesday"}
    with patch.object(emails, "_send") as send:
        emails.send_order_emails(order, ITEMS)
        text = send.call_args_list[0].kwargs["text"]
        html = send.call_args_list[0].kwargs["html"]
    assert "We cook on Monday 7 September and deliver on Wednesday 9 September evening." in text
    assert "Wednesday 9 September evening" in html
    assert "cook on Monday and" not in text


def test_confirmation_without_cook_date_falls_back_to_weekday(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com")
    with patch.object(emails, "_send") as send:
        emails.send_order_emails(ORDER, ITEMS)  # ORDER has no cook_date
        text = send.call_args_list[0].kwargs["text"]
    assert "We deliver on Monday evening." in text
    assert "cook on" not in text


def test_cook_and_delivery_dates():
    assert emails.cook_and_delivery({"cook_date": "2026-09-07", "delivery_day": "Monday"}) == \
        ("Monday 7 September", "Monday 7 September")
    assert emails.cook_and_delivery({"cook_date": "2026-09-07", "delivery_day": "Tuesday"}) == \
        ("Monday 7 September", "Tuesday 8 September")
