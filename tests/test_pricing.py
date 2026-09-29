import pytest

from api._lib.pricing import CartError, discount_for, price_order

DISHES = [
    {"id": "d1", "name": "Cochinita", "category": "chef", "available": True},
    {"id": "d2", "name": "Rajas", "category": "classic", "available": True},
    {"id": "d3", "name": "Sold out dish", "category": "classic", "available": False},
]
SIZES = [
    {"id": "s400", "name": "El Chico", "grams": 400, "price_classic": 13.5, "price_chef": 17.5},
    {"id": "s750", "name": "El Grande", "grams": 750, "price_classic": 22.5, "price_chef": 29.5},
]
# discount_pct 0: the discount tests below switch it on explicitly
SETTINGS = {"order_fee": 4, "max_packs": 5, "discount_threshold_grams": 2000, "discount_pct": 0}


def line(dish, size, qty=1):
    return {"dish_id": dish, "size_id": size, "qty": qty}


def test_single_pack_totals():
    t = price_order([line("d1", "s750")], DISHES, SETTINGS, sizes=SIZES)
    assert t.subtotal_cents == 2950
    assert t.discount_cents == 0
    assert t.fee_cents == 400
    assert t.total_cents == 3350
    assert t.grams == 750
    assert (t.items[0].dish_name, t.items[0].size_name, t.items[0].pack_size) == ("Cochinita", "El Grande", 750)
    assert t.items[0].label == "El Grande · Cochinita"


def test_price_follows_dish_category_and_size():
    t = price_order([line("d1", "s400", 2), line("d2", "s750")], DISHES, SETTINGS, sizes=SIZES)
    # chef small ×2 + classic large
    assert t.subtotal_cents == 2 * 1750 + 2250
    assert t.total_cents == t.subtotal_cents + 400
    assert t.grams == 2 * 400 + 750


def test_dish_without_category_prices_as_classic():
    dishes = [{"id": "d9", "name": "Legacy", "available": True}]
    t = price_order([line("d9", "s400")], dishes, SETTINGS, sizes=SIZES)
    assert t.subtotal_cents == 1350


def test_decimal_prices():
    sizes = [{**SIZES[0], "price_classic": 13.55}]
    t = price_order([line("d2", "s400")], DISHES, SETTINGS, sizes=sizes)
    assert t.subtotal_cents == 1355


def test_empty_cart_rejected():
    with pytest.raises(CartError):
        price_order([], DISHES, SETTINGS, sizes=SIZES)


def test_unknown_dish_rejected():
    with pytest.raises(CartError):
        price_order([line("nope", "s400")], DISHES, SETTINGS, sizes=SIZES)


def test_unavailable_dish_rejected():
    with pytest.raises(CartError):
        price_order([line("d3", "s400")], DISHES, SETTINGS, sizes=SIZES)


def test_unknown_size_rejected():
    with pytest.raises(CartError, match="pack size"):
        price_order([line("d1", "s999")], DISHES, SETTINGS, sizes=SIZES)
    with pytest.raises(CartError, match="pack size"):
        price_order([{"dish_id": "d1", "pack_size": 400, "qty": 1}], DISHES, SETTINGS, sizes=SIZES)


def test_over_max_packs_rejected():
    with pytest.raises(CartError):
        price_order([line("d1", "s400", 6)], DISHES, SETTINGS, sizes=SIZES)


def test_zero_caps_mean_no_limit():
    extras = [{"id": "x1", "name": "Salsa", "price": 1, "included": False, "max_qty": 100, "available": True}]
    t = price_order([line("d1", "s400", 60), {"extra_id": "x1", "qty": 40}], DISHES,
                    {**SETTINGS, "max_packs": 0, "max_extras": 0}, extras, SIZES)
    assert t.grams == 60 * 400
    # a missing max_extras still defaults to 10
    with pytest.raises(CartError, match="Maximum 10 sides"):
        price_order([line("d1", "s400"), {"extra_id": "x1", "qty": 11}], DISHES,
                    {**SETTINGS, "max_packs": 0}, extras, SIZES)


def test_zero_or_negative_qty_rejected():
    with pytest.raises(CartError):
        price_order([line("d1", "s400", 0)], DISHES, SETTINGS, sizes=SIZES)
    with pytest.raises(CartError):
        price_order([line("d1", "s400", -1)], DISHES, SETTINGS, sizes=SIZES)


# --- grams discount ---------------------------------------------------------------

DISCOUNT_ON = {**SETTINGS, "discount_pct": 3}


def test_discount_needs_strictly_more_than_threshold():
    # 2 × 750 + 2 × 400 = 2300 g > 2000 → 3% on the guisos subtotal
    t = price_order([line("d1", "s750", 2), line("d2", "s400", 2)], DISHES, DISCOUNT_ON, sizes=SIZES)
    packs = 2 * 2950 + 2 * 1350
    assert t.subtotal_cents == packs
    assert t.discount_cents == round(packs * 0.03)
    assert t.total_cents == packs - t.discount_cents + 400
    # exactly 2000 g does not qualify
    t = price_order([line("d2", "s400", 5)], DISHES, DISCOUNT_ON, sizes=SIZES)
    assert t.grams == 2000
    assert t.discount_cents == 0


def test_discount_ignores_sides_and_fee():
    extras = [{"id": "x1", "name": "Salsa roja", "price": 5.5, "included": False, "max_qty": 5, "available": True}]
    t = price_order([line("d1", "s750", 3), {"extra_id": "x1", "qty": 2}], DISHES, DISCOUNT_ON, extras, SIZES)
    packs = 3 * 2950
    assert t.discount_cents == round(packs * 0.03)
    assert t.subtotal_cents == packs + 2 * 550
    assert t.total_cents == t.subtotal_cents - t.discount_cents + 400


def test_discount_rounds_half_up_and_switches_off():
    assert discount_for(1050, 2001, {"discount_threshold_grams": 2000, "discount_pct": 5}) == 53  # 52.5 → 53
    assert discount_for(10000, 2001, {"discount_threshold_grams": 2000, "discount_pct": 0}) == 0
    assert discount_for(10000, 2001, {}) == 0
    assert discount_for(10000, 1, {"discount_threshold_grams": 0, "discount_pct": 10}) == 1000


# --- extras ---------------------------------------------------------------------

EXTRAS = [
    {"id": "x1", "name": "Salsa roja", "price": 2.5, "free_per_pack": 0, "max_qty": 5, "available": True},
    {"id": "x2", "name": "Tortillas · maiz", "price": 3, "free_per_pack": 5, "max_qty": 5, "available": True},
    {"id": "x3", "name": "Pickled onions", "price": 1.5, "free_per_pack": 0, "max_qty": 5, "available": False},
    {"id": "x4", "name": "Lime wedges", "price": 1, "free_per_pack": 0, "max_qty": 2, "available": True},
    {"id": "x5", "name": "Coriander", "price": 2, "free_per_pack": 1, "max_qty": 6, "available": True},
    {"id": "x6", "name": "Tortillas", "price": 5, "free_per_pack": 1, "max_free": 2, "max_qty": 10, "available": True},
    {"id": "x7", "name": "Salsa verde", "price": 3, "free_per_order": 2, "max_qty": 10, "available": True},
]
SETTINGS_X = {**SETTINGS, "max_extras": 6}
PACK = line("d1", "s750")


def test_extras_added_to_subtotal():
    t = price_order([PACK, {"extra_id": "x1", "qty": 2}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert t.subtotal_cents == 2950 + 2 * 250
    extra = [i for i in t.items if i.kind == "extra"][0]
    assert (extra.dish_name, extra.pack_size, extra.qty, extra.unit_price_cents) == ("Salsa roja", None, 2, 250)
    assert extra.label == "Salsa roja"


def test_included_extra_is_free_even_with_a_stored_price():
    t = price_order([PACK, {"extra_id": "x2", "qty": 1}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert t.subtotal_cents == 2950
    assert t.items[1].unit_price_cents == 0


def test_free_per_pack_splits_into_included_and_paid_lines():
    # 1 pack, 3 coriander, 1 free per pack → 1 × €0 + 2 × €2
    t = price_order([PACK, {"extra_id": "x5", "qty": 3}], DISHES, SETTINGS, EXTRAS, SIZES)
    extras = [(i.dish_name, i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"]
    assert extras == [("Coriander", 1, 0), ("Coriander", 2, 200)]
    assert t.subtotal_cents == 2950 + 400
    # 2 packs → 2 free, 1 paid
    t = price_order([{**PACK, "qty": 2}, {"extra_id": "x5", "qty": 3}], DISHES, SETTINGS, EXTRAS, SIZES)
    extras = [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"]
    assert extras == [(2, 0), (1, 200)]
    # all free: only the included line; all paid: only the paid line
    t = price_order([{**PACK, "qty": 3}, {"extra_id": "x5", "qty": 3}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(3, 0)]
    t = price_order([PACK, {"extra_id": "x1", "qty": 2}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(2, 250)]


def test_max_free_caps_the_free_units_per_order():
    # 4 packs would earn 4 free tortillas, the cap stops at 2 → 2 × €0 + 2 × €5
    t = price_order([{**PACK, "qty": 4}, {"extra_id": "x6", "qty": 4}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(2, 0), (2, 500)]
    # under the cap the per-pack rule still applies: 1 pack → 1 free
    t = price_order([PACK, {"extra_id": "x6", "qty": 2}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(1, 0), (1, 500)]
    # max_free 0 or missing = no cap (coriander: 5 packs → 5 free)
    t = price_order([{**PACK, "qty": 5}, {"extra_id": "x5", "qty": 5}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(5, 0)]


def test_free_per_order_is_flat_whatever_the_pack_count():
    for packs in (1, 5):
        t = price_order([{**PACK, "qty": packs}, {"extra_id": "x7", "qty": 3}], DISHES, SETTINGS, EXTRAS, SIZES)
        assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(2, 0), (1, 300)]


def test_free_units_count_packs_listed_after_the_side():
    # line order in the request must not matter
    t = price_order([{"extra_id": "x5", "qty": 2}, {**PACK, "qty": 2}], DISHES, SETTINGS, EXTRAS, SIZES)
    assert t.items[0].kind == "pack"
    assert [(i.qty, i.unit_price_cents) for i in t.items if i.kind == "extra"] == [(2, 0)]


def test_extras_without_a_pack_rejected():
    with pytest.raises(CartError, match="at least one guiso"):
        price_order([{"extra_id": "x1", "qty": 1}], DISHES, SETTINGS, EXTRAS, SIZES)


def test_sold_out_extra_rejected():
    with pytest.raises(CartError, match="sold out"):
        price_order([PACK, {"extra_id": "x3", "qty": 1}], DISHES, SETTINGS, EXTRAS, SIZES)


def test_unknown_extra_rejected():
    with pytest.raises(CartError):
        price_order([PACK, {"extra_id": "nope", "qty": 1}], DISHES, SETTINGS, EXTRAS, SIZES)


def test_extra_per_item_cap():
    with pytest.raises(CartError, match="Maximum 2× Lime wedges"):
        price_order([PACK, {"extra_id": "x4", "qty": 3}], DISHES, SETTINGS_X, EXTRAS, SIZES)
    price_order([PACK, {"extra_id": "x4", "qty": 2}], DISHES, SETTINGS_X, EXTRAS, SIZES)  # at the cap is fine


def test_extras_global_cap():
    with pytest.raises(CartError, match="Maximum 6 sides"):
        price_order([PACK, {"extra_id": "x1", "qty": 5}, {"extra_id": "x2", "qty": 2}], DISHES, SETTINGS_X, EXTRAS, SIZES)
    price_order([PACK, {"extra_id": "x1", "qty": 4}, {"extra_id": "x2", "qty": 2}], DISHES, SETTINGS_X, EXTRAS, SIZES)
