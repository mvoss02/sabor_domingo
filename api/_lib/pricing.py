from dataclasses import dataclass

MAX_EXTRA_QTY = 10


class CartError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class Item:
    dish_id: str
    dish_name: str
    pack_size: int | None
    qty: int
    unit_price_cents: int
    kind: str = "pack"  # "pack" | "extra"

    @property
    def label(self) -> str:
        return f"{self.pack_size}-meal pack · {self.dish_name}" if self.kind == "pack" else self.dish_name


@dataclass
class Totals:
    subtotal_cents: int
    fee_cents: int
    total_cents: int
    items: list[Item]


def _cents(euros) -> int:
    return int(round(float(euros) * 100))


def price_order(lines: list[dict], dishes: list[dict], settings: dict,
                extras: list[dict] | None = None) -> Totals:
    """Server-side truth for what a cart costs. Lines are either packs
    ({dish_id, pack_size, qty}) or extras ({extra_id, qty}); the client's
    numbers are never trusted."""
    if not lines:
        raise CartError("Cart is empty.")

    by_id = {d["id"]: d for d in dishes}
    extras_by_id = {e["id"]: e for e in (extras or [])}
    prices = {4: _cents(settings["price_4"]), 10: _cents(settings["price_10"])}

    items: list[Item] = []
    total_packs = 0
    for line in lines:
        qty = line.get("qty")
        if not isinstance(qty, int) or qty < 1:
            raise CartError("Invalid quantity.")

        if line.get("extra_id"):
            extra = extras_by_id.get(line["extra_id"])
            if extra is None:
                raise CartError("Unknown extra in cart.")
            if not extra.get("available"):
                raise CartError(f"'{extra['name']}' is sold out.")
            if qty > MAX_EXTRA_QTY:
                raise CartError(f"Maximum {MAX_EXTRA_QTY} of each extra.")
            items.append(Item(extra["id"], extra["name"], None, qty, _cents(extra["price"]), kind="extra"))
            continue

        dish = by_id.get(line.get("dish_id"))
        if dish is None:
            raise CartError("Unknown dish in cart.")
        if not dish.get("available"):
            raise CartError(f"'{dish['name']}' is sold out this week.")
        size = line.get("pack_size")
        if size not in prices:
            raise CartError("Invalid pack size.")
        total_packs += qty
        items.append(Item(dish["id"], dish["name"], size, qty, prices[size]))

    if total_packs == 0:
        raise CartError("Add at least one meal pack — extras come along with a pack.")
    if total_packs > int(settings["max_packs"]):
        raise CartError(f"Maximum {settings['max_packs']} packs per order.")

    subtotal = sum(i.unit_price_cents * i.qty for i in items)
    fee = _cents(settings["order_fee"])
    return Totals(subtotal, fee, subtotal + fee, items)
