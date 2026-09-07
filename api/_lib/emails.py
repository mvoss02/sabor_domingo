import html as html_mod
from datetime import date, timedelta
from decimal import Decimal

import httpx

from api._lib.config import env
from api._lib.window import DAYS

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts"
LOGO_URL = "https://www.sabordomingo.nl/img/logo-white.png"


def _esc(v) -> str:
    return html_mod.escape(str(v or ""))


def _html_wrap(body: str) -> str:
    """Brand shell: maroon header with logo, cream card. Inline styles only —
    email clients strip everything else."""
    return f"""\
<div style="margin:0;padding:24px 12px;background:#f6eee0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;border-radius:16px;overflow:hidden;background:#fdf6e8;">
    <div style="background:#5e1d22;padding:22px 28px;text-align:center;">
      <img src="{LOGO_URL}" alt="Sabor Domingo" height="52" style="height:52px;width:auto;">
    </div>
    <div style="padding:26px 28px 30px;color:#3d1f18;font-size:15px;line-height:1.65;">
      {body}
    </div>
    <div style="background:#c8492a;color:#fdf6e8;text-align:center;padding:12px;font-size:11.5px;letter-spacing:0.08em;text-transform:uppercase;">
      Como en casa, but in Amsterdam
    </div>
  </div>
</div>"""


def _label(i: dict) -> str:
    if i.get("kind", "pack") == "pack":
        return f"{i['pack_size']}-meal pack · {i['dish_name']}"
    return str(i["dish_name"])


def _price(i: dict) -> str:
    return "included" if float(i.get("unit_price") or 0) == 0 else f"€{_eur(i['unit_price'])}"


def _items_html(items: list[dict]) -> str:
    rows = "".join(
        f'<tr><td style="padding:7px 0;border-bottom:1px solid #ece0cb;">'
        f'{i["qty"]}&times; {_esc(_label(i))}</td>'
        f'<td style="padding:7px 0;border-bottom:1px solid #ece0cb;text-align:right;white-space:nowrap;">'
        f'{_price(i).replace("€", "&euro;")}</td></tr>'
        for i in items
    )
    return f'<table style="width:100%;border-collapse:collapse;font-size:14.5px;color:#3d1f18;">{rows}</table>' 


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


def _send(subject: str, text: str, to: list[str], html: str | None = None) -> None:
    payload = {
        "sender": {"name": "Sabor Domingo", "email": env("EMAIL_FROM")},
        "to": [{"email": addr} for addr in to],
        "subject": subject,
        "textContent": text,
    }
    if html:
        payload["htmlContent"] = html
    resp = httpx.post(
        BREVO_URL,
        headers={"api-key": env("BREVO_API_KEY"), "accept": "application/json"},
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()


def _admins() -> list[str]:
    return [a.strip() for a in env("ADMIN_EMAILS").split(",") if a.strip()]


def _items_text(items: list[dict]) -> str:
    return "\n".join(f"  {i['qty']}× {_label(i)} — {_price(i)}" for i in items)


def _long_date(d: date) -> str:
    return f"{d:%A} {d.day} {d:%B}"  # "Monday 7 September"


def cook_and_delivery(order: dict) -> tuple[str, str]:
    """Human dates for the confirmation email, from the order's frozen
    cook_date. Delivery is the named weekday on/after the cook date. Falls
    back to weekday names if cook_date is missing (rows older than
    migration 0008)."""
    raw = order.get("cook_date")
    delivery_day = order.get("delivery_day", "")
    if not raw:
        return "", delivery_day
    cook = date.fromisoformat(str(raw))
    try:
        offset = (DAYS.index(delivery_day) - cook.weekday()) % 7
    except ValueError:
        return _long_date(cook), delivery_day
    return _long_date(cook), _long_date(cook + timedelta(days=offset))


def _schedule_sentence(order: dict, html: bool = False) -> str:
    cook, deliver = cook_and_delivery(order)
    deliver_s = f"<strong>{_esc(deliver)} evening</strong>" if html else f"{deliver} evening"
    if cook:
        return f"We cook on {_esc(cook) if html else cook} and deliver on {deliver_s}."
    return f"We deliver on {deliver_s}."


def send_order_emails(order: dict, items: list[dict]) -> None:
    ref = f"#SD-{order['ref_num']}"

    _send(
        subject=f"Your Sabor Domingo order {ref} is confirmed",
        text=(
            f"Hola {order['name']},\n\n"
            f"Your order {ref} is confirmed. {_schedule_sentence(order)}"
            f"\n\nYour pack:\n{_items_text(items)}\n\n"
            f"Total: €{_eur(order['total'])}\n\n"
            "Everything arrives chilled and portioned with reheating notes — "
            "fridge for 4 days, freezer for a month.\n\n"
            "Un apapacho,\nMaca & Clau"
        ),
        to=[order["email"]],
        html=_html_wrap(
            f'<p style="font-family:Georgia,serif;font-size:22px;color:#c8492a;margin:0 0 4px;">&iexcl;gracias!</p>'
            f'<h1 style="font-size:24px;letter-spacing:-0.02em;color:#5e1d22;margin:0 0 14px;">Your order is in.</h1>'
            f'<p style="margin:0 0 18px;">Hola {_esc(order["name"])}, order <strong>{ref}</strong> is confirmed. '
            f'{_schedule_sentence(order, html=True)}</p>'
            f'{_items_html(items)}'
            f'<table style="width:100%;border-collapse:collapse;margin-top:10px;"><tr>'
            f'<td style="font-weight:600;font-size:15px;color:#5e1d22;">Total</td>'
            f'<td style="text-align:right;font-weight:700;font-size:20px;color:#c8492a;">&euro;{_eur(order["total"])}</td>'
            f'</tr></table>'
            f'<p style="margin:18px 0 0;font-size:13.5px;color:#6a4a3f;">Everything arrives chilled and portioned '
            f'with reheating notes &mdash; fridge for 4 days, freezer for a month.</p>'
            f'<p style="margin:14px 0 0;font-family:Georgia,serif;font-size:17px;color:#c8492a;">Un apapacho,<br>Maca &amp; Clau</p>'
        ),
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
        html=_html_wrap(
            f'<h1 style="font-size:20px;color:#5e1d22;margin:0 0 12px;">New order {ref}</h1>'
            f'<p style="margin:0 0 14px;">'
            f'<strong>{_esc(order["name"])}</strong> &middot; {_esc(order["email"])} &middot; {_esc(order.get("phone") or "—")}<br>'
            f'{_esc(order["address"])}, {_esc(order.get("postal_code", ""))}<br>'
            f'Delivery: <strong>{_esc(order["delivery_day"])}</strong><br>'
            f'Notes: {_esc(order["notes"] or "—")}</p>'
            f'{_items_html(items)}'
            f'<p style="margin:12px 0 0;font-weight:700;color:#c8492a;font-size:17px;">Total &euro;{_eur(order["total"])}</p>'
        ),
    )


def send_refund_email(order: dict, amount: float, full: bool) -> None:
    ref = f"#SD-{order['ref_num']}"
    tail = ("Your order is cancelled — nothing will be delivered."
            if full else "The rest of your order stays as planned.")
    _send(
        subject=f"Refund of €{_eur(amount)} for your Sabor Domingo order {ref}",
        text=(
            f"Hola {order['name']},\n\n"
            f"We've refunded €{_eur(amount)} for order {ref} to your original payment method. "
            f"It usually shows up within 5–10 business days, depending on your bank.\n\n"
            f"{tail}\n\nUn apapacho,\nMaca & Clau"
        ),
        to=[order["email"]],
        html=_html_wrap(
            f'<h1 style="font-size:22px;letter-spacing:-0.02em;color:#5e1d22;margin:0 0 14px;">Refund on its way</h1>'
            f'<p style="margin:0 0 14px;">Hola {_esc(order["name"])}, we&rsquo;ve refunded '
            f'<strong>&euro;{_eur(amount)}</strong> for order <strong>{ref}</strong> to your original payment method. '
            f'It usually shows up within 5&ndash;10 business days, depending on your bank.</p>'
            f'<p style="margin:0 0 14px;">{_esc(tail)}</p>'
            f'<p style="margin:14px 0 0;font-family:Georgia,serif;font-size:17px;color:#c8492a;">Un apapacho,<br>Maca &amp; Clau</p>'
        ),
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
