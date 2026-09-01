import stripe
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from api._lib.config import env
from api._lib.db import get_client
from api._lib.emails import send_inquiry_notification
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
