from unittest.mock import MagicMock, patch

from api._lib import webhook


def event(kind, session_id="cs_123", payment_intent="pi_1"):
    return {"type": kind,
            "data": {"object": {"id": session_id, "payment_intent": payment_intent,
                                 "metadata": {"order_id": "order-uuid-1"}}}}


def db_returning(updated_rows):
    client = MagicMock()
    order_q = MagicMock()
    order_q.update.return_value = order_q
    order_q.eq.return_value = order_q
    order_q.select.return_value = order_q
    order_q.execute.return_value = MagicMock(data=updated_rows)
    client.table.return_value = order_q
    return client


def test_completed_marks_paid_and_fires_email():
    db = db_returning([{"id": "order-uuid-1", "ref_num": 241, "email": "a@b.c"}])
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        assert webhook.handle_event(event("checkout.session.completed")) == "paid"
        hook.assert_called_once()


def test_completed_twice_is_idempotent():
    db = db_returning([])  # update matched no pending_payment row -> already handled
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        assert webhook.handle_event(event("checkout.session.completed")) == "ignored"
        hook.assert_not_called()


def test_expired_marks_cancelled():
    db = db_returning([{"id": "order-uuid-1"}])
    with patch.object(webhook, "get_client", return_value=db):
        assert webhook.handle_event(event("checkout.session.expired")) == "cancelled"


def test_unknown_event_ignored():
    with patch.object(webhook, "get_client", return_value=MagicMock()):
        assert webhook.handle_event(event("payment_intent.created")) == "ignored"


def test_bad_signature_400():
    from fastapi.testclient import TestClient
    from api.index import app
    import os
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    client = TestClient(app)
    resp = client.post("/api/py/stripe-webhook", content=b"{}",
                       headers={"stripe-signature": "t=1,v1=bad"})
    assert resp.status_code == 400
