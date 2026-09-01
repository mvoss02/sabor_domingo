from dataclasses import dataclass


class CartError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class Item:
    dish_id: str
    dish_name: str
    pack_size: int
    qty: int
    unit_price_cents: int


@dataclass
class Totals:
    subtotal_cents: int
    fee_cents: int
    total_cents: int
    items: list[Item]


def _cents(euros) -> int:
    return int(round(float(euros) * 100))


def price_order(lines: list[dict], dishes: list[dict], settings: dict) -> Totals:
    if not lines:
        raise CartError("Cart is empty.")

    by_id = {d["id"]: d for d in dishes}
    prices = {4: _cents(settings["price_4"]), 10: _cents(settings["price_10"])}

    items: list[Item] = []
    total_packs = 0
    for line in lines:
        dish = by_id.get(line.get("dish_id"))
        if dish is None:
            raise CartError("Unknown dish in cart.")
        if not dish.get("available"):
            raise CartError(f"'{dish['name']}' is not available this week.")
        size = line.get("pack_size")
        if size not in prices:
            raise CartError("Invalid pack size.")
        qty = line.get("qty")
        if not isinstance(qty, int) or qty < 1:
            raise CartError("Invalid quantity.")
        total_packs += qty
        items.append(Item(dish["id"], dish["name"], size, qty, prices[size]))

    if total_packs > int(settings["max_packs"]):
        raise CartError(f"Maximum {settings['max_packs']} packs per order.")

    subtotal = sum(i.unit_price_cents * i.qty for i in items)
    fee = _cents(settings["order_fee"])
    return Totals(subtotal, fee, subtotal + fee, items)
