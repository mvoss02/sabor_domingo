from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


class CartError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class Item:
    dish_id: str
    dish_name: str
    pack_size: int | None  # grams for packs, None for extras
    qty: int
    unit_price_cents: int
    kind: str = "pack"  # "pack" | "extra"
    size_name: str = ""

    @property
    def label(self) -> str:
        return f"{self.size_name} · {self.dish_name}" if self.kind == "pack" else self.dish_name


@dataclass
class Totals:
    subtotal_cents: int
    discount_cents: int
    fee_cents: int
    total_cents: int
    items: list[Item]
    grams: int = 0


def _cents(euros) -> int:
    return int(round(float(euros) * 100))


def discount_for(packs_cents: int, grams: int, settings: dict) -> int:
    """Grams-based discount on the guisos subtotal only: strictly more than
    the threshold earns `discount_pct` percent, rounded half up to the cent.
    pct 0 (or no threshold configured) means no discount."""
    pct = Decimal(str(settings.get("discount_pct") or 0))
    threshold = int(settings.get("discount_threshold_grams") or 0)
    if pct <= 0 or grams <= threshold:
        return 0
    amount = (Decimal(packs_cents) * pct / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(amount)


def price_order(lines: list[dict], dishes: list[dict], settings: dict,
                extras: list[dict] | None = None, sizes: list[dict] | None = None) -> Totals:
    """Server-side truth for what a cart costs. Lines are either packs
    ({dish_id, size_id, qty}) or extras ({extra_id, qty}). Price comes from
    the size row and the dish's category; the client's numbers are never
    trusted."""
    if not lines:
        raise CartError("Cart is empty.")

    by_id = {d["id"]: d for d in dishes}
    extras_by_id = {e["id"]: e for e in (extras or [])}
    sizes_by_id = {s["id"]: s for s in (sizes or [])}

    for line in lines:
        qty = line.get("qty")
        if not isinstance(qty, int) or qty < 1:
            raise CartError("Invalid quantity.")

    # Packs first: the free side units depend on how many packs there are.
    items: list[Item] = []
    total_packs = 0
    total_extras = 0
    grams = 0
    for line in lines:
        if line.get("extra_id"):
            continue
        qty = line["qty"]
        dish = by_id.get(line.get("dish_id"))
        if dish is None:
            raise CartError("Unknown dish in cart.")
        if not dish.get("available"):
            raise CartError(f"'{dish['name']}' is sold out this week.")
        size = sizes_by_id.get(line.get("size_id"))
        if size is None:
            raise CartError("Invalid pack size.")
        price_key = "price_chef" if dish.get("category") == "chef" else "price_classic"
        unit = _cents(size[price_key])
        total_packs += qty
        grams += qty * int(size["grams"])
        items.append(Item(dish["id"], dish["name"], int(size["grams"]), qty, unit,
                          size_name=str(size["name"])))

    for line in lines:
        if not line.get("extra_id"):
            continue
        qty = line["qty"]
        extra = extras_by_id.get(line["extra_id"])
        if extra is None:
            raise CartError("Unknown extra in cart.")
        if not extra.get("available"):
            raise CartError(f"'{extra['name']}' is sold out.")
        max_qty = int(extra.get("max_qty") or 1)
        if qty > max_qty:
            raise CartError(f"Maximum {max_qty}× {extra['name']} per order.")
        total_extras += qty
        # Free units: a flat free_per_order, or free_per_pack × packs capped by
        # max_free (0 = no cap). The rest cost `price`. Two lines, so each
        # order line keeps a single honest unit price.
        per_order = int(extra.get("free_per_order") or 0)
        if per_order > 0:
            free = min(qty, per_order)
        else:
            earned = int(extra.get("free_per_pack") or 0) * total_packs
            cap = int(extra.get("max_free") or 0)
            free = min(qty, min(earned, cap) if cap > 0 else earned)
        if free > 0:
            items.append(Item(extra["id"], extra["name"], None, free, 0, kind="extra"))
        if qty - free > 0:
            items.append(Item(extra["id"], extra["name"], None, qty - free, _cents(extra["price"]), kind="extra"))

    if total_packs == 0:
        raise CartError("Add at least one guiso — sides come along with a pack.")
    # A cap of 0 means no limit per order.
    max_packs = int(settings["max_packs"])
    if max_packs and total_packs > max_packs:
        raise CartError(f"Maximum {max_packs} packs per order.")
    raw_max_extras = settings.get("max_extras")
    max_extras = 10 if raw_max_extras is None else int(raw_max_extras)
    if max_extras and total_extras > max_extras:
        raise CartError(f"Maximum {max_extras} sides per order.")

    packs_cents = sum(i.unit_price_cents * i.qty for i in items if i.kind == "pack")
    subtotal = sum(i.unit_price_cents * i.qty for i in items)
    discount = discount_for(packs_cents, grams, settings)
    fee = _cents(settings["order_fee"])
    return Totals(subtotal, discount, fee, subtotal - discount + fee, items, grams)
