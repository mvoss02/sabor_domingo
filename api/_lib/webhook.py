from api._lib.db import get_client


def on_order_paid(order: dict, items: list[dict]) -> None:
    from api._lib.emails import send_order_emails
    try:
        send_order_emails(order, items)
    except Exception as e:  # email must never fail the webhook
        print(f"email send failed for order {order.get('id')}: {e}")


def handle_event(event: dict) -> str:
    kind = event["type"]
    obj = event["data"]["object"]

    if kind == "checkout.session.completed":
        client = get_client()
        updated = (client.table("orders")
                   .update({"status": "paid", "stripe_payment_intent": obj.get("payment_intent")})
                   .eq("stripe_session_id", obj["id"])
                   .eq("status", "pending_payment")
                   .execute().data)
        if not updated:
            return "ignored"
        order = updated[0]
        items = (client.table("order_items").select("*")
                 .eq("order_id", order["id"]).execute().data)
        on_order_paid(order, items)
        return "paid"

    if kind == "checkout.session.expired":
        client = get_client()
        updated = (client.table("orders")
                   .update({"status": "cancelled"})
                   .eq("stripe_session_id", obj["id"])
                   .eq("status", "pending_payment")
                   .execute().data)
        return "cancelled" if updated else "ignored"

    return "ignored"
