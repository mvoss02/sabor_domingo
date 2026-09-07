import pytest

from api._lib.pricing import CartError, price_order

DISHES = [
    {"id": "d1", "name": "Cochinita", "available": True},
    {"id": "d2", "name": "Rajas", "available": True},
    {"id": "d3", "name": "Sold out dish", "available": False},
]
SETTINGS = {"price_4": 39, "price_10": 85, "order_fee": 4, "max_packs": 5}


def test_single_pack_totals():
    t = price_order([{"dish_id": "d1", "pack_size": 10, "qty": 1}], DISHES, SETTINGS)
    assert t.subtotal_cents == 8500
    assert t.fee_cents == 400
    assert t.total_cents == 8900
    assert t.items[0].dish_name == "Cochinita"
    assert t.items[0].unit_price_cents == 8500


def test_mixed_packs():
    t = price_order(
        [{"dish_id": "d1", "pack_size": 4, "qty": 2},
         {"dish_id": "d2", "pack_size": 10, "qty": 1}],
        DISHES, SETTINGS)
    assert t.subtotal_cents == 2 * 3900 + 8500
    assert t.total_cents == t.subtotal_cents + 400


def test_decimal_prices():
    t = price_order([{"dish_id": "d1", "pack_size": 4, "qty": 1}],
                    DISHES, {**SETTINGS, "price_4": 39.5})
    assert t.subtotal_cents == 3950


def test_empty_cart_rejected():
    with pytest.raises(CartError):
        price_order([], DISHES, SETTINGS)


def test_unknown_dish_rejected():
    with pytest.raises(CartError):
        price_order([{"dish_id": "nope", "pack_size": 4, "qty": 1}], DISHES, SETTINGS)


def test_unavailable_dish_rejected():
    with pytest.raises(CartError):
        price_order([{"dish_id": "d3", "pack_size": 4, "qty": 1}], DISHES, SETTINGS)


def test_bad_pack_size_rejected():
    with pytest.raises(CartError):
        price_order([{"dish_id": "d1", "pack_size": 6, "qty": 1}], DISHES, SETTINGS)


def test_over_max_packs_rejected():
    with pytest.raises(CartError):
        price_order([{"dish_id": "d1", "pack_size": 4, "qty": 6}], DISHES, SETTINGS)


def test_zero_or_negative_qty_rejected():
    with pytest.raises(CartError):
        price_order([{"dish_id": "d1", "pack_size": 4, "qty": 0}], DISHES, SETTINGS)
    with pytest.raises(CartError):
        price_order([{"dish_id": "d1", "pack_size": 4, "qty": -1}], DISHES, SETTINGS)


# --- extras ---------------------------------------------------------------------

EXTRAS = [
    {"id": "x1", "name": "Salsa roja", "price": 2.5, "available": True},
    {"id": "x2", "name": "Tortillas · maiz", "price": 0, "available": True},
    {"id": "x3", "name": "Pickled onions", "price": 1.5, "available": False},
]
PACK = {"dish_id": "d1", "pack_size": 10, "qty": 1}


def test_extras_added_to_subtotal():
    t = price_order([PACK, {"extra_id": "x1", "qty": 2}], DISHES, SETTINGS, EXTRAS)
    assert t.subtotal_cents == 8500 + 2 * 250
    extra = [i for i in t.items if i.kind == "extra"][0]
    assert (extra.dish_name, extra.pack_size, extra.qty, extra.unit_price_cents) == ("Salsa roja", None, 2, 250)
    assert extra.label == "Salsa roja"
    assert t.items[0].label == "10-meal pack · Cochinita"


def test_free_extra_is_kept_at_zero():
    t = price_order([PACK, {"extra_id": "x2", "qty": 1}], DISHES, SETTINGS, EXTRAS)
    assert t.subtotal_cents == 8500
    assert t.items[1].unit_price_cents == 0


def test_extras_without_a_pack_rejected():
    with pytest.raises(CartError, match="at least one meal pack"):
        price_order([{"extra_id": "x1", "qty": 1}], DISHES, SETTINGS, EXTRAS)


def test_sold_out_extra_rejected():
    with pytest.raises(CartError, match="sold out"):
        price_order([PACK, {"extra_id": "x3", "qty": 1}], DISHES, SETTINGS, EXTRAS)


def test_unknown_extra_rejected():
    with pytest.raises(CartError):
        price_order([PACK, {"extra_id": "nope", "qty": 1}], DISHES, SETTINGS, EXTRAS)


def test_extra_qty_capped():
    with pytest.raises(CartError):
        price_order([PACK, {"extra_id": "x1", "qty": 11}], DISHES, SETTINGS, EXTRAS)
