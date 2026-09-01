from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from api.index import app
from api._lib import orders

AMS = ZoneInfo("Europe/Amsterdam")
OPEN_NOW = datetime(2026, 9, 3, 15, 0, tzinfo=AMS)      # Thursday
CLOSED_NOW = datetime(2026, 8, 31, 12, 0, tzinfo=AMS)   # Monday

SETTINGS_ROW = {"price_4": 39, "price_10": 85, "order_fee": 4, "max_packs": 5,
                "open_day": "Wednesday", "close_day": "Sunday", "cutoff_time": "22:00",
                "window_override": "auto", "delivery_days": ["Monday", "Tuesday", "Wednesday"]}
DISH_ROWS = [{"id": "d1", "name": "Cochinita", "available": True}]

VALID_BODY = {"lines": [{"dish_id": "d1", "pack_size": 10, "qty": 1}],
              "name": "Ana", "email": "ana@example.com",
              "address": "Javastraat 44", "postal_code": "1094 hh", "phone": "+31612345678",
              "notes": "", "delivery_day": "Monday"}


def test_postal_code_normalized_and_phone_stored(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _, db = post(VALID_BODY, OPEN_NOW)
    assert resp.status_code == 200
    inserted = db.table("orders").insert.call_args.args[0]
    assert inserted["postal_code"] == "1094 HH"
    assert inserted["phone"] == "+31612345678"


def test_invalid_postal_code_422(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _, _ = post({**VALID_BODY, "postal_code": "10944"}, OPEN_NOW)
    assert resp.status_code == 422


def test_missing_phone_422(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    body = {k: v for k, v in VALID_BODY.items() if k != "phone"}
    resp, _, _ = post(body, OPEN_NOW)
    assert resp.status_code == 422


def fake_db():
    """Supabase client stub: .table(name) returns chainable query ending in .execute().

    Repeated .table(name) calls for the same name return the SAME mock
    instance (cached), so a test can inspect .insert.call_args /
    .update.call_args after the request to see what the route actually
    sent, even when a table is touched more than once per request
    (e.g. "orders" is inserted into, then updated).
    """
    client = MagicMock()
    tables: dict = {}

    def table(name):
        if name in tables:
            return tables[name]
        m = MagicMock()
        m.select.return_value = m
        m.eq.return_value = m
        m.insert.return_value = m
        m.update.return_value = m
        if name == "settings":
            m.execute.return_value = MagicMock(data=[SETTINGS_ROW])
        elif name == "dishes":
            m.execute.return_value = MagicMock(data=DISH_ROWS)
        elif name == "orders":
            m.execute.return_value = MagicMock(data=[{"id": "order-uuid-1", "ref_num": 241}])
        else:
            m.execute.return_value = MagicMock(data=[])
        tables[name] = m
        return m

    client.table.side_effect = table
    return client


def post(body, now):
    db = fake_db()
    with patch.object(orders, "_now", return_value=now), \
         patch.object(orders, "get_client", return_value=db), \
         patch.object(orders.stripe.checkout.Session, "create",
                      return_value=MagicMock(id="cs_123", url="https://stripe.test/pay")) as sc:
        client = TestClient(app)
        resp = client.post("/api/py/checkout", json=body)
        return resp, sc, db


def test_happy_path_returns_stripe_url(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, sc, db = post(VALID_BODY, OPEN_NOW)
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://stripe.test/pay"
    kwargs = sc.call_args.kwargs
    assert kwargs["metadata"]["order_id"] == "order-uuid-1"
    # total: 85 + 4 fee, in cents, across line items
    amounts = [li["price_data"]["unit_amount"] * li["quantity"] for li in kwargs["line_items"]]
    assert sum(amounts) == 8900
    # order is inserted explicitly as pending_payment, not left to an
    # unverified DB column default.
    insert_payload = db.table("orders").insert.call_args.args[0]
    assert insert_payload["status"] == "pending_payment"


def test_window_closed_409(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _, _ = post(VALID_BODY, CLOSED_NOW)
    assert resp.status_code == 409


def test_invalid_cart_400(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _, _ = post({**VALID_BODY, "lines": []}, OPEN_NOW)
    assert resp.status_code == 400


def test_bad_delivery_day_400(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _, _ = post({**VALID_BODY, "delivery_day": "Saturday"}, OPEN_NOW)
    assert resp.status_code == 400


def test_stripe_failure_marks_order_cancelled(monkeypatch):
    """When Stripe session creation blows up, the order row (already
    inserted) must flip to 'cancelled' rather than being left dangling
    in 'pending_payment', and the failure must propagate (not be
    swallowed into a fake success response).
    """
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    db = fake_db()
    with patch.object(orders, "_now", return_value=OPEN_NOW), \
         patch.object(orders, "get_client", return_value=db), \
         patch.object(orders.stripe.checkout.Session, "create",
                      side_effect=RuntimeError("stripe is down")):
        # raise_server_exceptions=False: we want to assert on the resulting
        # HTTP response (the route re-raises after marking the order
        # cancelled, and neither api/index.py nor FastAPI catches a bare
        # RuntimeError, so it surfaces as a 500) rather than catching the
        # exception in the test itself.
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/py/checkout", json=VALID_BODY)

    assert resp.status_code == 500

    orders_table = db.table("orders")
    assert orders_table.update.call_args.args[0] == {"status": "cancelled"}
    assert orders_table.eq.call_args.args == ("id", "order-uuid-1")
