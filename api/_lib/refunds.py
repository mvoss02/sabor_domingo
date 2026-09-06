from datetime import datetime, timezone
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
    refund = stripe.Refund.create(
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

    row = {
        "order_id": order_id,
        "stripe_refund_id": getattr(refund, "id", None),
        "amount": amount_c / 100,
        "reason": payload.reason[:500],
        "refunded_by": by,
    }
    saved = (client.table("order_refunds")
             .upsert(row, on_conflict="stripe_refund_id").execute().data)
    refund_row = saved[0] if saved else row

    from api._lib.emails import send_refund_email
    try:
        send_refund_email(order, amount_c / 100, full=new_status == "refunded")
    except Exception as e:  # money moved; a failed email must not look like a failed refund
        print(f"refund email failed for order {order_id}: {e}")

    return {"status": new_status, "refunded_total": new_done_c / 100,
            "refunded_now": amount_c / 100, "refund": refund_row}


def sync_charge_refund(client, charge: dict) -> str:
    """Mirror a refund made anywhere (our endpoint or the Stripe dashboard)
    onto the order row and the order_refunds log. Absolute values from the
    charge, so replays and out-of-order deliveries converge on the same
    state; refund rows upsert on stripe_refund_id so nothing doubles."""
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
    if not updated:
        return "ignored"

    order_id = updated[0]["id"]
    rows = [{
        "order_id": order_id,
        "stripe_refund_id": r["id"],
        "amount": int(r.get("amount") or 0) / 100,
        "reason": (r.get("metadata") or {}).get("reason", ""),
        "refunded_by": (r.get("metadata") or {}).get("by", "Stripe dashboard"),
        "created_at": datetime.fromtimestamp(int(r["created"]), tz=timezone.utc).isoformat(),
    } for r in _charge_refunds(charge) if r.get("id") and r.get("created")]
    if rows:
        client.table("order_refunds").upsert(rows, on_conflict="stripe_refund_id").execute()
    return "refund_synced"


def _charge_refunds(charge: dict) -> list[dict]:
    """Refund objects for a charge. Recent Stripe API versions don't embed
    `refunds` on the charge in webhook payloads any more, so fall back to
    listing them."""
    embedded = (charge.get("refunds") or {}).get("data")
    if embedded is not None:
        return [dict(r) for r in embedded]
    stripe.api_key = env("STRIPE_SECRET_KEY")
    return [r.to_dict() if hasattr(r, "to_dict") else dict(r)
            for r in stripe.Refund.list(charge=charge["id"], limit=100).auto_paging_iter()]
