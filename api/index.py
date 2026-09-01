import stripe
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from api._lib.config import env
from api._lib.db import get_client
from api._lib.emails import send_inquiry_notification, subscribe_contact
from api._lib.orders import CheckoutPayload, WindowClosed, create_checkout
from api._lib.pricing import CartError
from api._lib.webhook import handle_event

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


@app.get("/api/py/health")
def health():
    return {"status": "ok"}


@app.post("/api/py/checkout")
def checkout(payload: CheckoutPayload):
    try:
        url = create_checkout(payload)
    except WindowClosed:
        raise HTTPException(status_code=409, detail="Ordering is closed right now.")
    except CartError as e:
        raise HTTPException(status_code=400, detail=e.message)
    return {"url": url}


@app.post("/api/py/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, env("STRIPE_WEBHOOK_SECRET"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    return {"result": handle_event(event.to_dict() if hasattr(event, "to_dict") else event)}


class InquiryPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    type: str = Field(min_length=1, max_length=100)
    guests: str = Field(default="", max_length=50)
    message: str = Field(default="", max_length=2000)


@app.post("/api/py/inquiry")
def inquiry(payload: InquiryPayload):
    row = get_client().table("inquiries").insert(payload.model_dump()).execute().data[0]
    try:
        send_inquiry_notification(row)
    except Exception as e:
        print(f"inquiry email failed: {e}")
    return {"ok": True}


class SubscribePayload(BaseModel):
    email: EmailStr


@app.post("/api/py/subscribe")
def subscribe(payload: SubscribePayload):
    try:
        subscribe_contact(payload.email)
    except Exception as e:
        print(f"subscribe failed: {e}")
        raise HTTPException(status_code=502, detail="Could not subscribe right now.")
    return {"ok": True}


@app.get("/api/py/order-status")
def order_status(session_id: str):
    rows = (get_client().table("orders")
            .select("status, ref_num, delivery_day, total")
            .eq("stripe_session_id", session_id).execute().data)
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")
    o = rows[0]
    return {"status": o["status"], "ref": f"#SD-{o['ref_num']}",
            "delivery_day": o["delivery_day"], "total": o["total"]}
