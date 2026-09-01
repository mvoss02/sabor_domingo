import pytest
from unittest.mock import MagicMock, patch

from api._lib import webhook


def event(kind, session_id="cs_123", payment_intent="pi_1", payment_status="paid",
          order_id="order-uuid-1"):
    obj = {"id": session_id, "payment_intent": payment_intent}
    if order_id is not None:
        obj["metadata"] = {"order_id": order_id}
    if payment_status is not None:
        obj["payment_status"] = payment_status
    return {"type": kind, "data": {"object": obj}}


def db_returning(updated_rows, existing_rows=None):
    """Mock supabase client.

    `.update(...).eq(...).eq(...).execute()` (the status-transition write)
    returns `updated_rows`. `.select(...).eq(...).execute()` (the existence
    check used when nothing was updated) returns `existing_rows`, which
    defaults to a stub matching row when `updated_rows` is empty -- i.e. by
    default an unmatched update means "already handled", not "unknown order".
    Pass `existing_rows=[]` explicitly to simulate an order_id that doesn't
    exist at all.
    """
    if existing_rows is None:
        existing_rows = updated_rows or [{"id": "order-uuid-1"}]

    client = MagicMock()
    table = MagicMock()

    update_chain = MagicMock()
    update_chain.eq.return_value = update_chain
    update_chain.execute.return_value = MagicMock(data=updated_rows)
    table.update.return_value = update_chain

    select_chain = MagicMock()
    select_chain.eq.return_value = select_chain
    select_chain.execute.return_value = MagicMock(data=existing_rows)
    table.select.return_value = select_chain

    client.table.return_value = table
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


# -- Critical 1: delayed-payment methods (SEPA, Klarna) send `completed` with
# payment_status "unpaid"/"processing" before the money actually lands. --

def test_completed_with_unpaid_status_does_not_mark_paid():
    db = db_returning([{"id": "order-uuid-1"}])  # would succeed if we let it through
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        result = webhook.handle_event(event("checkout.session.completed", payment_status="unpaid"))
        assert result == "pending"
        hook.assert_not_called()
        db.table.assert_not_called()


def test_async_payment_succeeded_marks_paid():
    db = db_returning([{"id": "order-uuid-1", "ref_num": 241, "email": "a@b.c"}])
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        result = webhook.handle_event(
            event("checkout.session.async_payment_succeeded", payment_status=None))
        assert result == "paid"
        hook.assert_called_once()


def test_async_payment_failed_marks_cancelled():
    db = db_returning([{"id": "order-uuid-1"}])
    with patch.object(webhook, "get_client", return_value=db):
        result = webhook.handle_event(
            event("checkout.session.async_payment_failed", payment_status=None))
        assert result == "cancelled"


# -- Important 3: match on metadata.order_id, not stripe_session_id, which is
# written only after Session.create returns (race window). --

def test_completed_unknown_order_id_raises():
    db = db_returning([], existing_rows=[])  # no row at all, not even in another status
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        with pytest.raises(RuntimeError):
            webhook.handle_event(event("checkout.session.completed"))
        hook.assert_not_called()
