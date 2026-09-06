from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.index import app
from api._lib import admin_auth, refunds
from api._lib.admin_auth import require_admin

PAID = {"id": "order-uuid-1", "ref_num": 241, "name": "Ana", "email": "ana@example.com",
        "status": "paid", "total": 89.5, "refunded_total": 0,
        "stripe_payment_intent": "pi_1"}


def db_with(order_rows):
    client = MagicMock()
    q = MagicMock()
    for m in ("select", "eq", "update"):
        getattr(q, m).return_value = q
    q.execute.return_value = MagicMock(data=order_rows)
    client.table.return_value = q
    return client, q


@pytest.fixture
def as_admin():
    app.dependency_overrides[require_admin] = lambda: "maca@x.com"
    yield
    app.dependency_overrides.clear()


def post(order_id, body, db):
    with patch.object(refunds, "get_client", return_value=db), \
         patch.object(refunds.stripe.Refund, "create") as create, \
         patch("api._lib.emails.send_refund_email") as email:
        resp = TestClient(app).post(f"/api/py/admin/orders/{order_id}/refund", json=body)
    return resp, create, email


# --- auth ---------------------------------------------------------------------

def test_no_token_401():
    resp = TestClient(app).post("/api/py/admin/orders/x/refund", json={})
    assert resp.status_code == 401


def test_bad_token_401():
    fake = MagicMock()
    fake.auth.get_user.side_effect = Exception("invalid JWT")
    with patch.object(admin_auth, "get_client", return_value=fake):
        resp = TestClient(app).post("/api/py/admin/orders/x/refund", json={},
                                    headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401


def test_valid_token_reaches_handler():
    fake = MagicMock()
    fake.auth.get_user.return_value = MagicMock(user=MagicMock(email="maca@x.com"))
    db, _ = db_with([])  # order lookup finds nothing -> 404, proving we got past auth
    with patch.object(admin_auth, "get_client", return_value=fake), \
         patch.object(refunds, "get_client", return_value=db):
        resp = TestClient(app).post("/api/py/admin/orders/x/refund", json={},
                                    headers={"Authorization": "Bearer good"})
    assert resp.status_code == 404


# --- refund logic ---------------------------------------------------------------

def test_full_refund(monkeypatch, as_admin):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db, q = db_with([PAID])
    resp, create, email = post("order-uuid-1", {}, db)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "refunded", "refunded_total": 89.5, "refunded_now": 89.5}
    kw = create.call_args.kwargs
    assert kw["payment_intent"] == "pi_1"
    assert kw["amount"] == 8950  # float 89.5 -> exact cents
    assert kw["idempotency_key"] == "refund-order-uuid-1-0-8950"
    assert q.update.call_args.args[0] == {"refunded_total": 89.5, "status": "refunded"}
    email.assert_called_once()
    assert email.call_args.kwargs["full"] is True


def test_partial_refund_keeps_paid(monkeypatch, as_admin):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db, q = db_with([PAID])
    resp, create, email = post("order-uuid-1", {"amount": 10, "reason": "one pack less"}, db)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "paid"
    assert resp.json()["refunded_total"] == 10.0
    assert create.call_args.kwargs["amount"] == 1000
    assert create.call_args.kwargs["metadata"]["reason"] == "one pack less"
    assert q.update.call_args.args[0]["status"] == "paid"
    assert email.call_args.kwargs["full"] is False


def test_second_partial_refund_completes(monkeypatch, as_admin):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db, q = db_with([{**PAID, "refunded_total": 80.0}])
    resp, create, _ = post("order-uuid-1", {}, db)  # remaining 9.50
    assert resp.status_code == 200
    assert create.call_args.kwargs["amount"] == 950
    assert create.call_args.kwargs["idempotency_key"] == "refund-order-uuid-1-8000-950"
    assert resp.json() == {"status": "refunded", "refunded_total": 89.5, "refunded_now": 9.5}


def test_amount_over_remaining_400(monkeypatch, as_admin):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db, _ = db_with([{**PAID, "refunded_total": 80.0}])
    resp, create, _ = post("order-uuid-1", {"amount": 20}, db)
    assert resp.status_code == 400
    assert "€9.50" in resp.json()["detail"]
    create.assert_not_called()


def test_zero_amount_400(as_admin):
    db, _ = db_with([PAID])
    resp, create, _ = post("order-uuid-1", {"amount": 0}, db)
    assert resp.status_code == 400
    create.assert_not_called()


def test_not_paid_400(as_admin):
    db, _ = db_with([{**PAID, "status": "pending_payment"}])
    resp, create, _ = post("order-uuid-1", {}, db)
    assert resp.status_code == 400
    create.assert_not_called()


def test_no_payment_intent_400(as_admin):
    db, _ = db_with([{**PAID, "stripe_payment_intent": None}])
    resp, create, _ = post("order-uuid-1", {}, db)
    assert resp.status_code == 400
    create.assert_not_called()


def test_stripe_failure_does_not_touch_db(monkeypatch, as_admin):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db, q = db_with([PAID])
    with patch.object(refunds, "get_client", return_value=db), \
         patch.object(refunds.stripe.Refund, "create", side_effect=RuntimeError("stripe down")), \
         pytest.raises(RuntimeError):
        TestClient(app, raise_server_exceptions=True).post(
            "/api/py/admin/orders/order-uuid-1/refund", json={})
    q.update.assert_not_called()


def test_email_failure_still_returns_ok(monkeypatch, as_admin):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db, _ = db_with([PAID])
    with patch.object(refunds, "get_client", return_value=db), \
         patch.object(refunds.stripe.Refund, "create"), \
         patch("api._lib.emails.send_refund_email", side_effect=RuntimeError("brevo down")):
        resp = TestClient(app).post("/api/py/admin/orders/order-uuid-1/refund", json={})
    assert resp.status_code == 200


# --- webhook mirror -------------------------------------------------------------

def charge_event(amount, amount_refunded, intent="pi_1"):
    return {"type": "charge.refunded",
            "data": {"object": {"id": "ch_1", "payment_intent": intent,
                                "amount": amount, "amount_refunded": amount_refunded}}}


def test_webhook_full_refund_marks_refunded():
    from api._lib import webhook
    db, q = db_with([{"id": "order-uuid-1"}])
    with patch.object(webhook, "get_client", return_value=db):
        assert webhook.handle_event(charge_event(8950, 8950)) == "refund_synced"
    assert q.update.call_args.args[0] == {"refunded_total": 89.5, "status": "refunded"}
    q.eq.assert_called_with("stripe_payment_intent", "pi_1")


def test_webhook_partial_refund_only_updates_amount():
    from api._lib import webhook
    db, q = db_with([{"id": "order-uuid-1"}])
    with patch.object(webhook, "get_client", return_value=db):
        assert webhook.handle_event(charge_event(8950, 1000)) == "refund_synced"
    assert q.update.call_args.args[0] == {"refunded_total": 10.0}


def test_webhook_unknown_intent_ignored():
    from api._lib import webhook
    db, _ = db_with([])
    with patch.object(webhook, "get_client", return_value=db):
        assert webhook.handle_event(charge_event(8950, 8950, intent="pi_unknown")) == "ignored"


def test_cents_is_exact():
    assert refunds.cents(89.5) == 8950
    assert refunds.cents(0.1 + 0.2) == 30
    assert refunds.cents(None) == 0
