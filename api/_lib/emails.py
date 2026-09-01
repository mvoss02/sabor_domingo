from decimal import Decimal

import httpx

from api._lib.config import env

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts"


def _eur(v) -> str:
    # PostgREST returns numeric columns as float (e.g. 89.5, 85.0); formatting
    # via Decimal(str(v)) avoids float repr artifacts and always shows 2 dp.
    return f"{Decimal(str(v)):.2f}"


def subscribe_contact(email: str) -> None:
    resp = httpx.post(
        BREVO_CONTACTS_URL,
        headers={"api-key": env("BREVO_API_KEY"), "accept": "application/json"},
        json={
            "email": email,
            "listIds": [int(env("BREVO_LIST_ID"))],
            "updateEnabled": True,
        },
        timeout=10,
    )
    resp.raise_for_status()


def _send(subject: str, text: str, to: list[str]) -> None:
    resp = httpx.post(
        BREVO_URL,
        headers={"api-key": env("BREVO_API_KEY"), "accept": "application/json"},
        json={
            "sender": {"name": "Sabor Domingo", "email": env("EMAIL_FROM")},
            "to": [{"email": addr} for addr in to],
            "subject": subject,
            "textContent": text,
        },
        timeout=10,
    )
    resp.raise_for_status()


def _admins() -> list[str]:
    return [a.strip() for a in env("ADMIN_EMAILS").split(",") if a.strip()]


def _items_text(items: list[dict]) -> str:
    return "\n".join(
        f"  {i['qty']}× {i['pack_size']}-meal pack · {i['dish_name']} — €{_eur(i['unit_price'])}"
        for i in items)


def send_order_emails(order: dict, items: list[dict]) -> None:
    ref = f"#SD-{order['ref_num']}"

    _send(
        subject=f"Your Sabor Domingo order {ref} is confirmed",
        text=(
            f"Hola {order['name']},\n\n"
            f"Your order {ref} is confirmed. We cook on Monday and deliver on "
            f"{order['delivery_day']} evening.\n\nYour pack:\n{_items_text(items)}\n\n"
            f"Total: €{_eur(order['total'])}\n\n"
            "Everything arrives chilled and portioned with reheating notes — "
            "fridge for 4 days, freezer for a month.\n\n"
            "Un apapacho,\nMaca & Clau"
        ),
        to=[order["email"]],
    )

    _send(
        subject=f"New order {ref} — {order['name']} ({order['delivery_day']})",
        text=(
            f"{order['name']} <{order['email']}>\n"
            f"{order['address']}, {order.get('postal_code', '')}\n"
            f"Phone: {order.get('phone') or '—'}\n"
            f"Delivery: {order['delivery_day']}\nNotes: {order['notes'] or '—'}\n\n"
            f"{_items_text(items)}\n\nTotal: €{_eur(order['total'])}"
        ),
        to=_admins(),
    )


def send_inquiry_notification(inquiry: dict) -> None:
    _send(
        subject=f"Event inquiry — {inquiry['name']} ({inquiry['type']})",
        text=(
            f"{inquiry['name']} <{inquiry['email']}>\nType: {inquiry['type']}\n"
            f"Guests: {inquiry.get('guests') or '—'}\n\n{inquiry.get('message') or ''}"
        ),
        to=_admins(),
    )
