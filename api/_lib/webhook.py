from api._lib.db import get_client


def on_order_paid(order: dict, items: list[dict]) -> None:
    from api._lib.emails import send_order_emails
    try:
        send_order_emails(order, items)
    except Exception as e:  # email must never fail the webhook
        print(f"email send failed for order {order.get('id')}: {e}")


def _transition(client, obj: dict, new_status: str, from_status: str = "pending_payment"):
    """Move the order matched to this Stripe event from `from_status` to
    `new_status`. Returns the updated order row, or None if the update
    matched nothing (idempotent replay of an already-handled event).

    Matches primarily on metadata.order_id: api/_lib/orders.py sets
    stripe_session_id only *after* Session.create returns, so a fast webhook
    delivery can beat that write and find no row by session id (Important 3).
    order_id is set at order-insert time, before Stripe is even called, so
    it's always present by the time any webhook fires. When an order_id is
    given but the update matches no row, we distinguish "already handled"
    (order exists, just not in from_status any more) from "unknown order"
    (order_id doesn't exist at all) -- the latter raises so Stripe gets a 500
    and retries, instead of silently swallowing a stuck payment.

    Falls back to the old stripe_session_id match when metadata.order_id is
    missing (defensive, for events not created by our own checkout flow).
    """
    extra = {"stripe_payment_intent": obj.get("payment_intent")} if new_status == "paid" else {}
    order_id = (obj.get("metadata") or {}).get("order_id")

    if order_id:
        updated = (client.table("orders")
                   .update({"status": new_status, **extra})
                   .eq("id", order_id)
                   .eq("status", from_status)
                   .execute().data)
        if updated:
            return updated[0]
        existing = client.table("orders").select("id").eq("id", order_id).execute().data
        if existing:
            return None  # already transitioned by an earlier delivery of this event
        raise RuntimeError(f"webhook: order_id {order_id} not found")

    updated = (client.table("orders")
               .update({"status": new_status, **extra})
               .eq("stripe_session_id", obj["id"])
               .eq("status", from_status)
               .execute().data)
    return updated[0] if updated else None


def handle_event(event: dict) -> str:
    kind = event["type"]
    obj = event["data"]["object"]
    client = get_client()

    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if kind == "checkout.session.completed":
            # Delayed payment methods (SEPA, Klarna) fire `completed` before the
            # money is confirmed; the real confirmation is async_payment_succeeded.
            if obj.get("payment_status") not in ("paid", "no_payment_required"):
                return "pending"
        order = _transition(client, obj, "paid")
        if order is None:
            return "ignored"
        items = (client.table("order_items").select("*")
                 .eq("order_id", order["id"]).execute().data)
        on_order_paid(order, items)
        return "paid"

    if kind in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        order = _transition(client, obj, "cancelled")
        return "cancelled" if order else "ignored"

    return "ignored"
