import time as time_mod
from datetime import datetime
from zoneinfo import ZoneInfo

import stripe
import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from api._lib.config import env
from api._lib.db import get_client
from api._lib.pricing import CartError, price_order
from api._lib.window import cook_date_for, window_is_open

AMS = ZoneInfo("Europe/Amsterdam")
PHONE_RE = re.compile(r"^(\+[1-9]|00[1-9]|0[1-9])[0-9 \-()]{5,}$")


class CartLine(BaseModel):
    # A pack line carries dish_id + size_id; an extra line carries extra_id.
    dish_id: str | None = None
    extra_id: str | None = None
    size_id: str | None = None
    qty: int


class CheckoutPayload(BaseModel):
    lines: list[CartLine]
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    address: str = Field(min_length=1, max_length=500)
    postal_code: str = Field(pattern=r"^\d{4}\s?[A-Za-z]{2}$")
    phone: str = Field(min_length=6, max_length=40)
    notes: str = Field(default="", max_length=1000)
    delivery_day: str

    # Mirrors the browser's checks: the form is a courtesy, this is the rule.
    @field_validator("name")
    @classmethod
    def _real_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Please give us your name.")
        return v

    @field_validator("phone")
    @classmethod
    def _dialable_phone(cls, v: str) -> str:
        # starts like a real number: +31…, 0031…, or domestic 06… / 020…
        v = v.strip()
        if not PHONE_RE.match(v):
            raise ValueError("Phone must start with +31, 0031 or 0 — like +31 6 12345678.")
        return v

    @property
    def postal_normalized(self) -> str:
        raw = self.postal_code.replace(" ", "").upper()
        return f"{raw[:4]} {raw[4:]}"


class WindowClosed(Exception):
    pass


def _now() -> datetime:
    return datetime.now(AMS)


def create_checkout(payload: CheckoutPayload) -> str:
    client = get_client()
    settings = client.table("settings").select("*").eq("id", 1).execute().data[0]
    dishes = client.table("dishes").select("*").execute().data
    extras = client.table("extras").select("*").execute().data
    sizes = client.table("pack_sizes").select("*").execute().data

    now = _now()
    if not window_is_open(settings, now):
        raise WindowClosed()
    if payload.delivery_day not in settings["delivery_days"]:
        raise CartError("Invalid delivery day.")

    totals = price_order([l.model_dump() for l in payload.lines], dishes, settings, extras, sizes)

    order = client.table("orders").insert({
        "status": "pending_payment",
        "name": payload.name, "email": payload.email, "address": payload.address,
        "postal_code": payload.postal_normalized, "phone": payload.phone,
        "notes": payload.notes, "delivery_day": payload.delivery_day,
        # Frozen at order time so the admin's per-cycle view stays correct even
        # if the weekly schedule is changed later.
        "cook_date": cook_date_for(settings, now).isoformat(),
        "subtotal": totals.subtotal_cents / 100, "discount": totals.discount_cents / 100,
        "promo_discount": totals.promo_cents / 100,
        "fee": totals.fee_cents / 100, "total": totals.total_cents / 100,
    }).execute().data[0]

    client.table("order_items").insert([{
        "order_id": order["id"], "kind": i.kind, "pack_size": i.pack_size,
        "size_name": i.size_name, "dish_name": i.dish_name, "qty": i.qty, "unit_price": i.unit_price_cents / 100,
    } for i in totals.items]).execute()

    stripe.api_key = env("STRIPE_SECRET_KEY")
    site = env("SITE_URL")
    try:
        # Stripe Checkout has no negative line items and takes a single coupon
        # per session, so the grams discount and the promotion travel as one
        # one-off coupon worth exactly what price_order computed. They stay
        # two columns on the order for the admin and the emails.
        discounts = []
        off_cents = totals.discount_cents + totals.promo_cents
        if off_cents > 0:
            names = []
            if totals.discount_cents > 0:
                names.append(f"{settings.get('discount_pct')}% main dish discount")
            if totals.promo_cents > 0:
                names.append("promotion")
            coupon = stripe.Coupon.create(
                amount_off=off_cents, currency="eur", duration="once",
                name=" + ".join(names),
            )
            discounts = [{"coupon": coupon.id}]
        session = stripe.checkout.Session.create(
            mode="payment",
            discounts=discounts,
            customer_email=payload.email,
            # €0 extras ("included") are kept on the order but not sent to
            # Stripe as line items.
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": i.label},
                    "unit_amount": i.unit_price_cents,
                },
                "quantity": i.qty,
            } for i in totals.items if i.unit_price_cents > 0] + [{
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
