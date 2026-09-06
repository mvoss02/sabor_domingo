from decimal import Decimal

import stripe
from pydantic import BaseModel, Field

from api._lib.config import env
from api._lib.db import get_client


class RefundPayload(BaseModel):
    # Euros. None = everything not yet refunded (a full refund / cancellation).
    amount: float | None = None
    reason: str = Field(default="", max_length=500)


class OrderNotFound(Exception):
    pass


class RefundError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def cents(v) -> int:
    # PostgREST hands numerics back as float; go through str -> Decimal so
    # 89.5 becomes exactly 8950, never 8949.
    return int((Decimal(str(v or 0)) * 100).to_integral_value())


def refund_order(order_id: str, payload: RefundPayload, by: str = "") -> dict:
    """Refund part or all of a paid order through Stripe, then record it.

    Stripe is the source of truth for money; the DB row mirrors it. The
    idempotency key is derived from (order, already refunded, this amount),
    so a double-tap or a retry after a DB hiccup returns Stripe's existing
    refund instead of creating a second one.
    """
    client = get_client()
    rows = client.table("orders").select("*").eq("id", order_id).execute().data
    if not rows:
        raise OrderNotFound()
    order = rows[0]

    if order["status"] != "paid":
        raise RefundError("Only paid orders can be refunded.")
    intent = order.get("stripe_payment_intent")
    if not intent:
        raise RefundError("No Stripe payment is linked to this order.")

    total_c = cents(order["total"])
    done_c = cents(order.get("refunded_total"))
    remaining_c = total_c - done_c
    if remaining_c <= 0:
        raise RefundError("This order is already fully refunded.")

    amount_c = remaining_c if payload.amount is None else cents(payload.amount)
    if amount_c <= 0 or amount_c > remaining_c:
        raise RefundError(f"Amount must be between €0.01 and €{remaining_c / 100:.2f}.")

    stripe.api_key = env("STRIPE_SECRET_KEY")
    stripe.Refund.create(
        payment_intent=intent,
        amount=amount_c,
        metadata={"order_id": order_id, "reason": payload.reason[:500], "by": by},
        idempotency_key=f"refund-{order_id}-{done_c}-{amount_c}",
    )

    new_done_c = done_c + amount_c
    new_status = "refunded" if new_done_c >= total_c else "paid"
    client.table("orders").update({
        "refunded_total": new_done_c / 100,
        "status": new_status,
    }).eq("id", order_id).execute()

    from api._lib.emails import send_refund_email
    try:
        send_refund_email(order, amount_c / 100, full=new_status == "refunded")
    except Exception as e:  # money moved; a failed email must not look like a failed refund
        print(f"refund email failed for order {order_id}: {e}")

    return {"status": new_status, "refunded_total": new_done_c / 100, "refunded_now": amount_c / 100}


def sync_charge_refund(client, charge: dict) -> str:
    """Mirror a refund made anywhere (our endpoint or the Stripe dashboard)
    onto the order row. Absolute values from the charge, so replays and
    out-of-order deliveries converge on the same state."""
    intent = charge.get("payment_intent")
    if not intent:
        return "ignored"
    refunded_c = int(charge.get("amount_refunded") or 0)
    total_c = int(charge.get("amount") or 0)
    patch: dict = {"refunded_total": refunded_c / 100}
    if refunded_c >= total_c and total_c > 0:
        patch["status"] = "refunded"
    updated = (client.table("orders").update(patch)
               .eq("stripe_payment_intent", intent).execute().data)
    return "refund_synced" if updated else "ignored"
