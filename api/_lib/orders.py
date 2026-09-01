import time as time_mod
from datetime import datetime
from zoneinfo import ZoneInfo

import stripe
from pydantic import BaseModel, EmailStr, Field

from api._lib.config import env
from api._lib.db import get_client
from api._lib.pricing import CartError, price_order
from api._lib.window import window_is_open

AMS = ZoneInfo("Europe/Amsterdam")


class CartLine(BaseModel):
    dish_id: str
    pack_size: int
    qty: int


class CheckoutPayload(BaseModel):
    lines: list[CartLine]
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    address: str = Field(min_length=1, max_length=500)
    notes: str = Field(default="", max_length=1000)
    delivery_day: str


class WindowClosed(Exception):
    pass


def _now() -> datetime:
    return datetime.now(AMS)


def create_checkout(payload: CheckoutPayload) -> str:
    client = get_client()
    settings = client.table("settings").select("*").eq("id", 1).execute().data[0]
    dishes = client.table("dishes").select("*").execute().data

    if not window_is_open(settings, _now()):
        raise WindowClosed()
    if payload.delivery_day not in settings["delivery_days"]:
        raise CartError("Invalid delivery day.")

    totals = price_order([l.model_dump() for l in payload.lines], dishes, settings)

    order = client.table("orders").insert({
        "status": "pending_payment",
        "name": payload.name, "email": payload.email, "address": payload.address,
        "notes": payload.notes, "delivery_day": payload.delivery_day,
        "subtotal": totals.subtotal_cents / 100, "fee": totals.fee_cents / 100,
        "total": totals.total_cents / 100,
    }).execute().data[0]

    client.table("order_items").insert([{
        "order_id": order["id"], "pack_size": i.pack_size, "dish_name": i.dish_name,
        "qty": i.qty, "unit_price": i.unit_price_cents / 100,
    } for i in totals.items]).execute()

    stripe.api_key = env("STRIPE_SECRET_KEY")
    site = env("SITE_URL")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer_email=payload.email,
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": f"{i.pack_size}-meal pack · {i.dish_name}"},
                    "unit_amount": i.unit_price_cents,
                },
                "quantity": i.qty,
            } for i in totals.items] + [{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": "Order fee"},
                    "unit_amount": totals.fee_cents,
                },
                "quantity": 1,
            }],
            metadata={"order_id": order["id"]},
            success_url=f"{site}/order/confirmed?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{site}/?cancelled=1#order",
            # Stripe rejects expires_at under 30 min from creation; use 60 min to
            # avoid exact-30 clock-skew rejections.
            expires_at=int(time_mod.time()) + 60 * 60,
        )
    except Exception:
        client.table("orders").update({"status": "cancelled"}).eq("id", order["id"]).execute()
        raise

    client.table("orders").update({"stripe_session_id": session.id}).eq("id", order["id"]).execute()
    return session.url
