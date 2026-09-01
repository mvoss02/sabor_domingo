from unittest.mock import MagicMock, patch

from api._lib import emails

ORDER = {"id": "o1", "ref_num": 241, "name": "Ana", "email": "ana@example.com",
         "address": "Javastraat 44", "delivery_day": "Monday",
         "subtotal": 85, "fee": 4, "total": 89, "notes": ""}
ITEMS = [{"pack_size": 10, "dish_name": "Cochinita", "qty": 1, "unit_price": 85}]


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
        second = send.call_args_list[1]
        assert set(second.kwargs["to"]) == {"maca@x.com", "clau@x.com"}


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
