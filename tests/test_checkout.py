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
              "address": "Javastraat 44", "notes": "", "delivery_day": "Monday"}


def fake_db():
    """Supabase client stub: .table(name) returns chainable query ending in .execute()."""
    client = MagicMock()

    def table(name):
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
        return m

    client.table.side_effect = table
    return client


def post(body, now):
    with patch.object(orders, "_now", return_value=now), \
         patch.object(orders, "get_client", return_value=fake_db()), \
         patch.object(orders.stripe.checkout.Session, "create",
                      return_value=MagicMock(id="cs_123", url="https://stripe.test/pay")) as sc:
        client = TestClient(app)
        resp = client.post("/api/py/checkout", json=body)
        return resp, sc


def test_happy_path_returns_stripe_url(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, sc = post(VALID_BODY, OPEN_NOW)
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://stripe.test/pay"
    kwargs = sc.call_args.kwargs
    assert kwargs["metadata"]["order_id"] == "order-uuid-1"
    # total: 85 + 4 fee, in cents, across line items
    amounts = [li["price_data"]["unit_amount"] * li["quantity"] for li in kwargs["line_items"]]
    assert sum(amounts) == 8900


def test_window_closed_409(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _ = post(VALID_BODY, CLOSED_NOW)
    assert resp.status_code == 409


def test_invalid_cart_400(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _ = post({**VALID_BODY, "lines": []}, OPEN_NOW)
    assert resp.status_code == 400


def test_bad_delivery_day_400(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _ = post({**VALID_BODY, "delivery_day": "Saturday"}, OPEN_NOW)
    assert resp.status_code == 400
