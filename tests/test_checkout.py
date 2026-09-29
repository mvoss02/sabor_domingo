from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from api.index import app
from api._lib import orders

AMS = ZoneInfo("Europe/Amsterdam")
OPEN_NOW = datetime(2026, 9, 3, 15, 0, tzinfo=AMS)      # Thursday
CLOSED_NOW = datetime(2026, 8, 31, 12, 0, tzinfo=AMS)   # Monday

SETTINGS_ROW = {"order_fee": 4, "max_packs": 5, "discount_threshold_grams": 2000, "discount_pct": 3,
                "open_day": "Wednesday", "close_day": "Sunday", "cutoff_time": "22:00",
                "cook_day": "Monday",
                "window_override": "auto", "delivery_days": ["Monday", "Tuesday", "Wednesday"]}
DISH_ROWS = [{"id": "d1", "name": "Cochinita", "category": "chef", "available": True}]
SIZE_ROWS = [{"id": "s400", "name": "El Chico", "grams": 400, "price_classic": 13.5, "price_chef": 17.5},
             {"id": "s750", "name": "El Grande", "grams": 750, "price_classic": 22.5, "price_chef": 29.5}]
EXTRA_ROWS = [{"id": "x1", "name": "Salsa roja", "price": 2.5, "free_per_pack": 0, "max_qty": 5, "available": True},
              {"id": "x2", "name": "Tortillas · maiz", "price": 3, "free_per_pack": 5, "max_qty": 5, "available": True}]

VALID_BODY = {"lines": [{"dish_id": "d1", "size_id": "s750", "qty": 1}],
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
        elif name == "extras":
            m.execute.return_value = MagicMock(data=EXTRA_ROWS)
        elif name == "pack_sizes":
            m.execute.return_value = MagicMock(data=SIZE_ROWS)
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
         patch.object(orders.stripe.Coupon, "create", return_value=MagicMock(id="coupon_1")) as cc, \
         patch.object(orders.stripe.checkout.Session, "create",
                      return_value=MagicMock(id="cs_123", url="https://stripe.test/pay")) as sc:
        client = TestClient(app)
        resp = client.post("/api/py/checkout", json=body)
        sc.coupon_create = cc
        return resp, sc, db


def test_happy_path_returns_stripe_url(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, sc, db = post(VALID_BODY, OPEN_NOW)
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://stripe.test/pay"
    kwargs = sc.call_args.kwargs
    assert kwargs["metadata"]["order_id"] == "order-uuid-1"
    # total: 29.50 (chef, El Grande) + 4 fee, in cents, across line items
    amounts = [li["price_data"]["unit_amount"] * li["quantity"] for li in kwargs["line_items"]]
    assert sum(amounts) == 3350
    # 750 g is under the 2 kg threshold: no coupon, no discount on the order
    assert kwargs["discounts"] == []
    assert not sc.coupon_create.called
    assert db.table("orders").insert.call_args.args[0]["discount"] == 0
    # order is inserted explicitly as pending_payment, not left to an
    # unverified DB column default.
    insert_payload = db.table("orders").insert.call_args.args[0]
    assert insert_payload["status"] == "pending_payment"
    # Thursday 3 Sep order → cooked Monday 7 Sep
    assert insert_payload["cook_date"] == "2026-09-07"


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


def test_extras_become_order_lines_and_stripe_lines(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    body = {**VALID_BODY, "lines": VALID_BODY["lines"] + [{"extra_id": "x1", "qty": 2},
                                                         {"extra_id": "x2", "qty": 1}]}
    resp, sc, db = post(body, OPEN_NOW)
    assert resp.status_code == 200, resp.text
    items = db.table("order_items").insert.call_args.args[0]
    assert [(i["kind"], i["pack_size"], i["size_name"], i["dish_name"], i["qty"], i["unit_price"]) for i in items] == [
        ("pack", 750, "El Grande", "Cochinita", 1, 29.5),
        ("extra", None, "", "Salsa roja", 2, 2.5),
        ("extra", None, "", "Tortillas · maiz", 1, 0.0),
    ]
    names = [li["price_data"]["product_data"]["name"] for li in sc.call_args.kwargs["line_items"]]
    # the free tortillas are on the order but not a Stripe line
    assert names == ["El Grande · Cochinita", "Salsa roja", "Order fee"]
    amounts = [li["price_data"]["unit_amount"] * li["quantity"] for li in sc.call_args.kwargs["line_items"]]
    assert sum(amounts) == 2950 + 500 + 400


def test_grams_discount_becomes_a_stripe_coupon(monkeypatch):
    """Over the threshold the server computes the discount itself, stores it
    on the order and hands Stripe a one-off coupon for exactly that amount.
    Nothing in the request body can set the discount."""
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    body = {**VALID_BODY, "lines": [{"dish_id": "d1", "size_id": "s750", "qty": 3}], "discount": 99}
    resp, sc, db = post(body, OPEN_NOW)
    assert resp.status_code == 200, resp.text
    packs = 3 * 2950
    expected = round(packs * 0.03)  # 2250 g > 2000 g
    order = db.table("orders").insert.call_args.args[0]
    assert order["discount"] == expected / 100
    assert order["total"] == (packs - expected + 400) / 100
    coupon_kwargs = sc.coupon_create.call_args.kwargs
    assert (coupon_kwargs["amount_off"], coupon_kwargs["currency"], coupon_kwargs["duration"]) == (expected, "eur", "once")
    assert sc.call_args.kwargs["discounts"] == [{"coupon": "coupon_1"}]
    # line items still carry full prices; the coupon does the subtracting
    amounts = [li["price_data"]["unit_amount"] * li["quantity"] for li in sc.call_args.kwargs["line_items"]]
    assert sum(amounts) == packs + 400


def test_extras_only_cart_400(monkeypatch):
    monkeypatch.setenv("SITE_URL", "http://test.local")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    resp, _, _ = post({**VALID_BODY, "lines": [{"extra_id": "x1", "qty": 1}]}, OPEN_NOW)
    assert resp.status_code == 400
    assert "at least one guiso" in resp.json()["detail"]
