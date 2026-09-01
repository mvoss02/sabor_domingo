import html as html_mod
from decimal import Decimal

import httpx

from api._lib.config import env

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


def _items_html(items: list[dict]) -> str:
    rows = "".join(
        f'<tr><td style="padding:7px 0;border-bottom:1px solid #ece0cb;">'
        f'{i["qty"]}&times; {i["pack_size"]}-meal pack &middot; {_esc(i["dish_name"])}</td>'
        f'<td style="padding:7px 0;border-bottom:1px solid #ece0cb;text-align:right;white-space:nowrap;">'
        f'&euro;{_eur(i["unit_price"])}</td></tr>'
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
        html=_html_wrap(
            f'<p style="font-family:Georgia,serif;font-size:22px;color:#c8492a;margin:0 0 4px;">&iexcl;gracias!</p>'
            f'<h1 style="font-size:24px;letter-spacing:-0.02em;color:#5e1d22;margin:0 0 14px;">Your order is in.</h1>'
            f'<p style="margin:0 0 18px;">Hola {_esc(order["name"])}, order <strong>{ref}</strong> is confirmed. '
            f'We cook on Monday and deliver on <strong>{_esc(order["delivery_day"])} evening</strong>.</p>'
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


def send_inquiry_notification(inquiry: dict) -> None:
    _send(
        subject=f"Event inquiry — {inquiry['name']} ({inquiry['type']})",
        text=(
            f"{inquiry['name']} <{inquiry['email']}>\nType: {inquiry['type']}\n"
            f"Guests: {inquiry.get('guests') or '—'}\n\n{inquiry.get('message') or ''}"
        ),
        to=_admins(),
    )
