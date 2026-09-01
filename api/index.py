from fastapi import FastAPI, HTTPException

from api._lib.orders import CheckoutPayload, WindowClosed, create_checkout
from api._lib.pricing import CartError

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
