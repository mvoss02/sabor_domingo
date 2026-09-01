# Sabor Domingo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production ordering site for a weekly Mexican meal-pack business: landing page, pack builder + Stripe Checkout, admin panel, on Vercel.

**Architecture:** One Vercel project: Next.js app (landing, order flow, admin) + FastAPI in `api/index.py` deployed as a Python serverless function (official Vercel Next.js+FastAPI pattern, next.config rewrites `/api/py/*`). Supabase = Postgres + Auth + Storage; browser reads public data directly (RLS), all money paths go through FastAPI. Stripe Checkout (hosted, iDEAL + cards) with webhook as source of truth. Brevo for email.

**Tech Stack:** Next.js (App Router, TypeScript, no Tailwind — prototype uses inline styles), FastAPI, supabase-py, supabase-js, stripe (python), Brevo transactional email via httpx (no SDK), pytest.

**Spec:** `docs/superpowers/specs/2026-09-01-sabor-domingo-design.md`

## Global Constraints

- Timezone for all order-window logic: `Europe/Amsterdam` (server-side, never client clock).
- All prices computed server-side from DB; client-sent totals are never trusted.
- Money in euro cents (int) in backend + Stripe; DB stores euros as `numeric(8,2)`.
- Order status transitions only forward: `pending_payment → paid` or `pending_payment → cancelled`; `refunded` set manually later. Webhook handlers idempotent.
- Visual reference: `design-reference/sabor-standalone-src.html` (inline styles; convert mechanically to JSX `style` objects). Copy/text content comes from this file.
- Python ≥3.12, deps pinned in `requirements.txt`. Node deps via npm.
- Secrets only via env vars; `.env.local` / `.env` gitignored; `.env.example` maintained.
- Env var names (fixed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY`, `EMAIL_FROM` (Brevo-verified sender address), `ADMIN_EMAILS` (comma-separated), `SITE_URL`. (Changed 2026-09-01: Brevo replaces Resend; `.env.example` updated in Task 8.)
- FastAPI routes all prefixed `/api/py/` (full path in route decorators — Vercel passes original URL).
- Commit after every task (conventional commits).

---

### Task 1: Scaffold — Next.js + FastAPI hybrid

**Files:**
- Create: Next.js app at repo root (`create-next-app`), `api/index.py`, `requirements.txt`, `next.config.ts` (rewrites), `.env.example`, update `.gitignore`, `package.json` scripts

**Interfaces:**
- Produces: dev commands `npm run dev` (Next on :3000) + `npm run fastapi-dev` (uvicorn on :8000); FastAPI app object `app` in `api/index.py`; all later Python code lives in `api/_lib/` (underscore prefix ⇒ Vercel does not treat as function).

- [ ] **Step 1: Scaffold Next.js in place**

```bash
cd /Users/moritz/Developer/projects/sabor_domingo
npx create-next-app@latest . --typescript --app --no-tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm
```

(If it complains about existing files `docs/`, `design-reference/`: run in a temp dir and move generated files in, or use `--skip-install` variants; end state = Next.js app at root alongside `docs/` and `design-reference/`.)

- [ ] **Step 2: Python venv + requirements**

```bash
python3 -m venv .venv && source .venv/bin/activate
```

`requirements.txt`:
```
fastapi==0.115.*
uvicorn==0.30.*
stripe==10.*
supabase==2.*
resend==2.*
pytest==8.*
httpx==0.27.*
```

```bash
pip install -r requirements.txt
```

- [ ] **Step 3: Hello FastAPI**

`api/index.py`:
```python
from fastapi import FastAPI

app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


@app.get("/api/py/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Rewrites + dev scripts**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/py/:path*"
            : "/api/",
      },
    ];
  },
};

export default nextConfig;
```

`package.json` scripts (add):
```json
"fastapi-dev": "uvicorn api.index:app --reload --port 8000"
```

Add to `.gitignore`: `.venv/`, `.env`, `.env.local`, `__pycache__/`.

Create `.env.example` listing every env var from Global Constraints with placeholder values.

- [ ] **Step 5: Verify both servers**

Run: `npm run fastapi-dev` (background) and `npm run dev` (background), then:
```bash
curl -s http://127.0.0.1:8000/api/py/health   # {"status":"ok"}
curl -s http://localhost:3000/api/py/health   # same, via rewrite
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # 200
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js + FastAPI hybrid (Vercel pattern)"
```

---

### Task 2: Supabase project, schema, RLS, seed

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`, `supabase/migrations/0003_seed.sql`

**Interfaces:**
- Produces: tables `dishes`, `settings` (singleton id=1), `orders`, `order_items`, `site_content`, `inquiries`; storage bucket `images` (public read); RLS as in spec. Column names below are load-bearing for every later task.

- [ ] **Step 1: Create hosted Supabase project + link CLI**

Manual (Moritz or executor with dashboard access): create project `sabor-domingo` at supabase.com (region: eu-central). Then:
```bash
brew install supabase/tap/supabase 2>/dev/null || true
supabase login
supabase init
supabase link --project-ref <PROJECT_REF>
```
In dashboard: Authentication → Sign In / Up → disable "Allow new users to sign up". Create two users (Maca, Clau emails) manually under Authentication → Users.

- [ ] **Step 2: Schema migration**

`supabase/migrations/0001_schema.sql`:
```sql
create table dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null check (tag in ('Meat', 'Vegetarian')),
  description text not null default '',
  available boolean not null default true,
  image_path text,
  sort_order int not null default 0
);

create table settings (
  id int primary key check (id = 1),
  price_4 numeric(8,2) not null,
  price_10 numeric(8,2) not null,
  order_fee numeric(8,2) not null,
  max_packs int not null,
  open_day text not null,
  close_day text not null,
  cutoff_time time not null,
  cook_day text not null,
  delivery_days text[] not null,
  delivery_window text not null,
  delivery_area text not null,
  window_override text not null default 'auto' check (window_override in ('auto','open','closed'))
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  ref_num int generated by default as identity (start with 241),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','cancelled','refunded')),
  name text not null,
  email text not null,
  address text not null,
  notes text not null default '',
  delivery_day text not null,
  subtotal numeric(8,2) not null,
  fee numeric(8,2) not null,
  total numeric(8,2) not null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  pack_size int not null check (pack_size in (4,10)),
  dish_name text not null,
  qty int not null check (qty > 0),
  unit_price numeric(8,2) not null
);

create table site_content (
  key text primary key,
  value jsonb not null
);

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  type text not null,
  guests text not null default '',
  message text not null default '',
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public) values ('images', 'images', true);
```

- [ ] **Step 3: RLS migration**

`supabase/migrations/0002_rls.sql`:
```sql
alter table dishes enable row level security;
alter table settings enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table site_content enable row level security;
alter table inquiries enable row level security;

-- public reads
create policy "public read dishes" on dishes for select using (true);
create policy "public read settings" on settings for select using (true);
create policy "public read content" on site_content for select using (true);

-- admins (any authenticated user; signup disabled)
create policy "admin write dishes" on dishes for all to authenticated using (true) with check (true);
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);
create policy "admin write content" on site_content for all to authenticated using (true) with check (true);
create policy "admin read orders" on orders for select to authenticated using (true);
create policy "admin read order_items" on order_items for select to authenticated using (true);
create policy "admin all inquiries" on inquiries for all to authenticated using (true) with check (true);

-- storage: public read via public bucket; admin write
create policy "admin upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'images');
create policy "admin update images" on storage.objects for update to authenticated
  using (bucket_id = 'images');
create policy "admin delete images" on storage.objects for delete to authenticated
  using (bucket_id = 'images');
```
(No anon insert on inquiries: inquiry goes through FastAPI so email can fire — deliberate deviation from spec, noted here.)

- [ ] **Step 4: Seed migration**

`supabase/migrations/0003_seed.sql` — values from prototype defaults:
```sql
insert into dishes (name, tag, description, sort_order) values
  ('Meat dish one', 'Meat', 'Placeholder — a slow-cooked beef or pork guiso from San Luis Potosí. Rename in admin each week.', 0),
  ('Meat dish two', 'Meat', 'Placeholder — a chicken dish in a red or green salsa. Rename in admin each week.', 1),
  ('Vegetarian dish', 'Vegetarian', 'Placeholder — a mushroom, nopal or bean guiso. Rename in admin each week.', 2);

insert into settings (id, price_4, price_10, order_fee, max_packs,
  open_day, close_day, cutoff_time, cook_day, delivery_days,
  delivery_window, delivery_area, window_override)
values (1, 39, 85, 4, 5,
  'Wednesday', 'Sunday', '22:00', 'Monday', array['Monday','Tuesday','Wednesday'],
  '17:00 – 19:00', 'Amsterdam within the ring', 'auto');

insert into site_content (key, value) values
  ('hero',   jsonb_build_object('title', 'A little apapacho from Mexico.', 'subtitle', 'como en casa, but in Amsterdam', 'body', 'Home-cooked meal packs from a real Mexican kitchen — ours. You order during the week, we cook everything fresh on Monday, and it arrives at your door ready to warm up.')),
  ('images', jsonb_build_object('hero', null, 'siblings', null, 'bio_maca', null, 'bio_clau', null)),
  ('faq',    (select jsonb_agg(jsonb_build_object('q', q, 'a', a)) from (values
    ('Where do you deliver?', 'Amsterdam within the ring, Monday to Wednesday evenings. Just outside? Message us on Instagram — we sometimes make it work.'),
    ('How do I reheat it?', 'Everything arrives chilled and portioned. Pan with a splash of water, or microwave. Fridge for 4 days, freezer for a month.'),
    ('Is it very spicy?', 'The dishes are mild — the heat lives in the salsa, which comes separate so you decide. Maca will still try to talk you into the spiciest one.'),
    ('Can I change my order?', 'Until Sunday 22:00, yes — message us and we adjust or refund. After that your ingredients are already bought.')
  ) as t(q, a)));
```
(Executor: cross-check exact FAQ copy against `design-reference/sabor-standalone-src.html`; the last answer is truncated in this plan.)

- [ ] **Step 5: Push migrations + verify**

```bash
supabase db push
```
Verify (Supabase SQL editor or `supabase db remote` psql): `select count(*) from dishes;` → 3; `select * from settings;` → 1 row; anon read works:
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/dishes?select=name" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" 
```

- [ ] **Step 6: Commit**

```bash
git add supabase && git commit -m "feat: supabase schema, RLS, seed"
```

---

### Task 3: Backend config + DB client + pytest wiring

**Files:**
- Create: `api/_lib/__init__.py`, `api/_lib/config.py`, `api/_lib/db.py`, `tests/conftest.py`, `pytest.ini`

**Interfaces:**
- Produces: `config.env(name, default=None)` (raises on missing required), `db.get_client()` → supabase `Client` (service role), FastAPI dependency-injectable. Tests import via `from api._lib import ...` (repo root on sys.path via pytest.ini).

- [ ] **Step 1: Config + client**

`api/_lib/config.py`:
```python
import os


def env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        raise RuntimeError(f"Missing required env var: {name}")
    return val
```

`api/_lib/db.py`:
```python
from functools import lru_cache

from supabase import Client, create_client

from api._lib.config import env


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
```

`pytest.ini`:
```ini
[pytest]
testpaths = tests
```

`tests/conftest.py`:
```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

- [ ] **Step 2: Smoke test**

`tests/test_config.py`:
```python
import pytest

from api._lib.config import env


def test_env_returns_value(monkeypatch):
    monkeypatch.setenv("FOO_VAR", "bar")
    assert env("FOO_VAR") == "bar"


def test_env_missing_raises():
    with pytest.raises(RuntimeError):
        env("DEFINITELY_NOT_SET_12345")
```

Run: `pytest -q` → 2 passed.

- [ ] **Step 3: Commit**

```bash
git add api tests pytest.ini && git commit -m "feat: backend config and supabase client"
```

---

### Task 4: Order-window logic (TDD)

**Files:**
- Create: `api/_lib/window.py`, `tests/test_window.py`

**Interfaces:**
- Produces: `window_is_open(settings: dict, now: datetime) -> bool` where `settings` is the settings row as dict (keys `open_day`, `close_day`, `cutoff_time` "HH:MM" or "HH:MM:SS" string, `window_override`) and `now` is tz-aware. Callers pass `datetime.now(ZoneInfo("Europe/Amsterdam"))`.

- [ ] **Step 1: Write failing tests**

`tests/test_window.py`:
```python
from datetime import datetime
from zoneinfo import ZoneInfo

from api._lib.window import window_is_open

AMS = ZoneInfo("Europe/Amsterdam")


def s(**over):
    base = {"open_day": "Wednesday", "close_day": "Sunday",
            "cutoff_time": "22:00", "window_override": "auto"}
    base.update(over)
    return base


def test_open_midweek():
    # Thursday afternoon
    assert window_is_open(s(), datetime(2026, 9, 3, 15, 0, tzinfo=AMS)) is True


def test_closed_monday():
    assert window_is_open(s(), datetime(2026, 8, 31, 12, 0, tzinfo=AMS)) is False


def test_open_sunday_before_cutoff():
    assert window_is_open(s(), datetime(2026, 9, 6, 21, 59, tzinfo=AMS)) is True


def test_closed_sunday_at_cutoff():
    assert window_is_open(s(), datetime(2026, 9, 6, 22, 0, tzinfo=AMS)) is False


def test_open_on_open_day_morning():
    # Wednesday 00:01
    assert window_is_open(s(), datetime(2026, 9, 2, 0, 1, tzinfo=AMS)) is True


def test_override_forces_closed():
    assert window_is_open(s(window_override="closed"),
                          datetime(2026, 9, 3, 15, 0, tzinfo=AMS)) is False


def test_override_forces_open():
    assert window_is_open(s(window_override="open"),
                          datetime(2026, 8, 31, 12, 0, tzinfo=AMS)) is True


def test_wrapping_window_sat_to_tue():
    st = s(open_day="Saturday", close_day="Tuesday")
    assert window_is_open(st, datetime(2026, 9, 6, 12, 0, tzinfo=AMS)) is True   # Sunday
    assert window_is_open(st, datetime(2026, 9, 3, 12, 0, tzinfo=AMS)) is False  # Thursday


def test_cutoff_with_seconds_format():
    # Postgres time comes back as "22:00:00"
    assert window_is_open(s(cutoff_time="22:00:00"),
                          datetime(2026, 9, 6, 21, 30, tzinfo=AMS)) is True
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_window.py -q` — Expected: FAIL (`ModuleNotFoundError` / import error).

- [ ] **Step 3: Implement**

`api/_lib/window.py`:
```python
from datetime import datetime, time

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _parse_cutoff(raw: str) -> time:
    parts = [int(p) for p in raw.split(":")]
    return time(parts[0], parts[1])


def window_is_open(settings: dict, now: datetime) -> bool:
    override = settings.get("window_override", "auto")
    if override == "open":
        return True
    if override == "closed":
        return False

    open_i = DAYS.index(settings["open_day"])
    close_i = DAYS.index(settings["close_day"])
    today_i = now.weekday()

    if open_i <= close_i:
        in_days = open_i <= today_i <= close_i
    else:  # window wraps the week boundary
        in_days = today_i >= open_i or today_i <= close_i

    if not in_days:
        return False
    if today_i == close_i and now.time() >= _parse_cutoff(str(settings["cutoff_time"])):
        return False
    return True
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest tests/test_window.py -q` — Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/window.py tests/test_window.py && git commit -m "feat: order window computation"
```

---

### Task 5: Pricing + cart validation (TDD)

**Files:**
- Create: `api/_lib/pricing.py`, `tests/test_pricing.py`

**Interfaces:**
- Consumes: nothing external (pure).
- Produces:
  - `class CartError(Exception)` with `.message`
  - `price_order(lines: list[dict], dishes: list[dict], settings: dict) -> Totals`
  - `Totals` dataclass: `subtotal_cents: int, fee_cents: int, total_cents: int, items: list[Item]`; `Item`: `dish_id: str, dish_name: str, pack_size: int, qty: int, unit_price_cents: int`
  - line dict shape (JSON from client): `{"dish_id": str, "pack_size": 4|10, "qty": int}`
  - euros→cents: `int(round(float(x) * 100))`

- [ ] **Step 1: Write failing tests**

`tests/test_pricing.py`:
```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_pricing.py -q` — Expected: FAIL (import error).

- [ ] **Step 3: Implement**

`api/_lib/pricing.py`:
```python
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest tests/test_pricing.py -q` — Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/pricing.py tests/test_pricing.py && git commit -m "feat: cart pricing and validation"
```

---

### Task 6: POST /api/py/checkout (order + Stripe session)

**Files:**
- Create: `api/_lib/orders.py`, `tests/test_checkout.py`
- Modify: `api/index.py`

**Interfaces:**
- Consumes: `window_is_open`, `price_order`/`CartError`, `db.get_client`.
- Produces:
  - `POST /api/py/checkout` body: `{"lines": [...], "name": str, "email": str, "address": str, "notes": str, "delivery_day": str}` → 200 `{"url": "<stripe checkout url>"}`; 400 `{"detail": "<human message>"}` on validation failure; 409 when window closed.
  - `orders.create_checkout(payload: CheckoutPayload, client, now) -> str` (returns Stripe URL) — route is a thin wrapper so tests hit logic directly.
  - Stripe session: `metadata={"order_id": ...}`, `customer_email`, line items from priced items + fee line, `success_url=f"{SITE_URL}/order/confirmed?session_id={{CHECKOUT_SESSION_ID}}"`, `cancel_url=f"{SITE_URL}/?cancelled=1#order"`, `expires_at` now+30min.

- [ ] **Step 1: Write failing tests**

`tests/test_checkout.py` (mock supabase client + stripe; test the route through FastAPI TestClient):
```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_checkout.py -q` — Expected: FAIL (no module `orders`, no route).

- [ ] **Step 3: Implement**

`api/_lib/orders.py`:
```python
import time as time_mod
from datetime import datetime
from zoneinfo import ZoneInfo

import stripe
from pydantic import BaseModel, EmailStr, Field

from api._lib.config import env
from api._lib.db import get_client
from api._lib.pricing import CartError, price_order
from api._lib.window import window_is_open

AMS = ZoneInfo("Europe/Amsterdam")


class CartLine(BaseModel):
    dish_id: str
    pack_size: int
    qty: int


class CheckoutPayload(BaseModel):
    lines: list[CartLine]
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    address: str = Field(min_length=1, max_length=500)
    notes: str = Field(default="", max_length=1000)
    delivery_day: str


class WindowClosed(Exception):
    pass


def _now() -> datetime:
    return datetime.now(AMS)


def create_checkout(payload: CheckoutPayload) -> str:
    client = get_client()
    settings = client.table("settings").select("*").eq("id", 1).execute().data[0]
    dishes = client.table("dishes").select("*").execute().data

    if not window_is_open(settings, _now()):
        raise WindowClosed()
    if payload.delivery_day not in settings["delivery_days"]:
        raise CartError("Invalid delivery day.")

    totals = price_order([l.model_dump() for l in payload.lines], dishes, settings)

    order = client.table("orders").insert({
        "name": payload.name, "email": payload.email, "address": payload.address,
        "notes": payload.notes, "delivery_day": payload.delivery_day,
        "subtotal": totals.subtotal_cents / 100, "fee": totals.fee_cents / 100,
        "total": totals.total_cents / 100,
    }).execute().data[0]

    client.table("order_items").insert([{
        "order_id": order["id"], "pack_size": i.pack_size, "dish_name": i.dish_name,
        "qty": i.qty, "unit_price": i.unit_price_cents / 100,
    } for i in totals.items]).execute()

    stripe.api_key = env("STRIPE_SECRET_KEY")
    site = env("SITE_URL")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer_email=payload.email,
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": f"{i.pack_size}-meal pack · {i.dish_name}"},
                    "unit_amount": i.unit_price_cents,
                },
                "quantity": i.qty,
            } for i in totals.items] + [{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": "Order fee"},
                    "unit_amount": totals.fee_cents,
                },
                "quantity": 1,
            }],
            metadata={"order_id": order["id"]},
            success_url=f"{site}/order/confirmed?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{site}/?cancelled=1#order",
            expires_at=int(time_mod.time()) + 30 * 60,
        )
    except Exception:
        client.table("orders").update({"status": "cancelled"}).eq("id", order["id"]).execute()
        raise

    client.table("orders").update({"stripe_session_id": session.id}).eq("id", order["id"]).execute()
    return session.url
```

`api/index.py` — replace with:
```python
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
```

Add `pydantic[email]` to `requirements.txt` (email validator) and `pip install -r requirements.txt`.

- [ ] **Step 4: Run to verify pass**

Run: `pytest tests/test_checkout.py -q` — Expected: 4 passed. Then full suite `pytest -q`.

- [ ] **Step 5: Commit**

```bash
git add api tests requirements.txt && git commit -m "feat: checkout endpoint creating order + stripe session"
```

---

### Task 7: Stripe webhook (idempotent, source of truth)

**Files:**
- Create: `api/_lib/webhook.py`, `tests/test_webhook.py`
- Modify: `api/index.py`

**Interfaces:**
- Consumes: `db.get_client`, later `emails.py` (Task 8 wires in; this task defines the hook point `on_order_paid(order: dict, items: list[dict]) -> None` as a no-op placeholder function IN `webhook.py` that Task 8 replaces with real emails).
- Produces:
  - `POST /api/py/stripe-webhook` — raw body + `stripe-signature` header, verified with `STRIPE_WEBHOOK_SECRET` via `stripe.Webhook.construct_event`. 400 on bad signature.
  - `handle_event(event: dict) -> str` returning one of `"paid" | "cancelled" | "ignored"`.
  - Transition rule: update `orders.status` only where current status = `pending_payment` (idempotency). `checkout.session.completed` → `paid` (+ store `payment_intent`, fire `on_order_paid`); `checkout.session.expired` → `cancelled`.

- [ ] **Step 1: Write failing tests**

`tests/test_webhook.py`:
```python
from unittest.mock import MagicMock, patch

from api._lib import webhook


def event(kind, session_id="cs_123", payment_intent="pi_1"):
    return {"type": kind,
            "data": {"object": {"id": session_id, "payment_intent": payment_intent,
                                 "metadata": {"order_id": "order-uuid-1"}}}}


def db_returning(updated_rows):
    client = MagicMock()
    order_q = MagicMock()
    order_q.update.return_value = order_q
    order_q.eq.return_value = order_q
    order_q.select.return_value = order_q
    order_q.execute.return_value = MagicMock(data=updated_rows)
    client.table.return_value = order_q
    return client


def test_completed_marks_paid_and_fires_email():
    db = db_returning([{"id": "order-uuid-1", "ref_num": 241, "email": "a@b.c"}])
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        assert webhook.handle_event(event("checkout.session.completed")) == "paid"
        hook.assert_called_once()


def test_completed_twice_is_idempotent():
    db = db_returning([])  # update matched no pending_payment row -> already handled
    with patch.object(webhook, "get_client", return_value=db), \
         patch.object(webhook, "on_order_paid") as hook:
        assert webhook.handle_event(event("checkout.session.completed")) == "ignored"
        hook.assert_not_called()


def test_expired_marks_cancelled():
    db = db_returning([{"id": "order-uuid-1"}])
    with patch.object(webhook, "get_client", return_value=db):
        assert webhook.handle_event(event("checkout.session.expired")) == "cancelled"


def test_unknown_event_ignored():
    with patch.object(webhook, "get_client", return_value=MagicMock()):
        assert webhook.handle_event(event("payment_intent.created")) == "ignored"
```

Signature verification test (route level):
```python
def test_bad_signature_400():
    from fastapi.testclient import TestClient
    from api.index import app
    import os
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    client = TestClient(app)
    resp = client.post("/api/py/stripe-webhook", content=b"{}",
                       headers={"stripe-signature": "t=1,v1=bad"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_webhook.py -q` — Expected: FAIL.

- [ ] **Step 3: Implement**

`api/_lib/webhook.py`:
```python
from api._lib.db import get_client


def on_order_paid(order: dict, items: list[dict]) -> None:
    """Replaced with real email sending in emails task."""


def handle_event(event: dict) -> str:
    kind = event["type"]
    obj = event["data"]["object"]

    if kind == "checkout.session.completed":
        client = get_client()
        updated = (client.table("orders")
                   .update({"status": "paid", "stripe_payment_intent": obj.get("payment_intent")})
                   .eq("stripe_session_id", obj["id"])
                   .eq("status", "pending_payment")
                   .execute().data)
        if not updated:
            return "ignored"
        order = updated[0]
        items = (client.table("order_items").select("*")
                 .eq("order_id", order["id"]).execute().data)
        on_order_paid(order, items)
        return "paid"

    if kind == "checkout.session.expired":
        client = get_client()
        updated = (client.table("orders")
                   .update({"status": "cancelled"})
                   .eq("stripe_session_id", obj["id"])
                   .eq("status", "pending_payment")
                   .execute().data)
        return "cancelled" if updated else "ignored"

    return "ignored"
```

`api/index.py` — add:
```python
import stripe
from fastapi import Request

from api._lib.config import env
from api._lib.webhook import handle_event


@app.post("/api/py/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, env("STRIPE_WEBHOOK_SECRET"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    return {"result": handle_event(event.to_dict() if hasattr(event, "to_dict") else event)}
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest tests/test_webhook.py -q` then `pytest -q` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api tests && git commit -m "feat: stripe webhook with idempotent status transitions"
```

---

### Task 8: Emails (Brevo) + inquiry endpoint

**Files:**
- Create: `api/_lib/emails.py`, `tests/test_emails.py`
- Modify: `api/_lib/webhook.py` (replace `on_order_paid` body), `api/index.py` (inquiry route), `requirements.txt` (remove `resend` line), `.env.example` (replace RESEND_API_KEY with BREVO_API_KEY + EMAIL_FROM placeholders)

**Interfaces:**
- Consumes: Brevo transactional API `POST https://api.brevo.com/v3/smtp/email` (header `api-key`, JSON body with `sender`/`to`/`subject`/`textContent`) via `httpx` (already in requirements); `config.env`; `db.get_client`.
- Produces:
  - `emails.send_order_emails(order: dict, items: list[dict]) -> None` — customer confirmation + admin notification (`ADMIN_EMAILS` comma-separated). Sender: `{"name": "Sabor Domingo", "email": env("EMAIL_FROM")}` — EMAIL_FROM must be a Brevo-verified sender.
  - `emails._send(subject: str, text: str, to: list[str]) -> None` — single seam wrapping the httpx POST; raises on non-2xx (`resp.raise_for_status()`), 10s timeout. Tests patch `_send` (unit) and `httpx.post` (one payload-shape test).
  - `emails.send_inquiry_notification(inquiry: dict) -> None`
  - `POST /api/py/inquiry` body `{"name","email","type","guests","message"}` → inserts row (service role) + notifies admins → `{"ok": true}`. Never 500s to the user on email failure (email wrapped in try/except; insert is what matters).
  - `webhook.on_order_paid` now calls `send_order_emails`; email failure must NOT fail the webhook (Stripe would retry forever) — wrap in try/except, log via `print` (shows in Vercel logs).

- [ ] **Step 1: Write failing tests**

`tests/test_emails.py`:
```python
from unittest.mock import MagicMock, patch

from api._lib import emails

ORDER = {"id": "o1", "ref_num": 241, "name": "Ana", "email": "ana@example.com",
         "address": "Javastraat 44", "delivery_day": "Monday",
         "subtotal": 85, "fee": 4, "total": 89, "notes": ""}
ITEMS = [{"pack_size": 10, "dish_name": "Cochinita", "qty": 1, "unit_price": 85}]


def test_sends_customer_and_admin_email(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com,clau@x.com")
    with patch.object(emails, "_send") as send:
        emails.send_order_emails(ORDER, ITEMS)
        assert send.call_count == 2
        first = send.call_args_list[0]
        assert first.kwargs["to"] == ["ana@example.com"]
        assert "#SD-241" in first.kwargs["subject"]
        second = send.call_args_list[1]
        assert set(second.kwargs["to"]) == {"maca@x.com", "clau@x.com"}


def test_send_posts_brevo_payload(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    with patch.object(emails.httpx, "post") as post:
        post.return_value = MagicMock(status_code=201)
        emails._send(subject="Hi", text="Body", to=["a@b.c"])
        args, kwargs = post.call_args
        assert args[0] == "https://api.brevo.com/v3/smtp/email"
        assert kwargs["headers"]["api-key"] == "xkeysib-test"
        body = kwargs["json"]
        assert body["sender"]["email"] == "hola@sabordomingo.test"
        assert body["to"] == [{"email": "a@b.c"}]
        assert body["subject"] == "Hi"
        assert body["textContent"] == "Body"


def test_order_paid_hook_survives_email_failure(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("EMAIL_FROM", "hola@sabordomingo.test")
    monkeypatch.setenv("ADMIN_EMAILS", "maca@x.com")
    from api._lib import webhook
    with patch.object(emails, "_send", side_effect=RuntimeError("boom")):
        webhook.on_order_paid(ORDER, ITEMS)  # must not raise
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_emails.py -q` — Expected: FAIL.

- [ ] **Step 3: Implement**

`api/_lib/emails.py`:
```python
import httpx

from api._lib.config import env

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _send(subject: str, text: str, to: list[str]) -> None:
    resp = httpx.post(
        BREVO_URL,
        headers={"api-key": env("BREVO_API_KEY"), "accept": "application/json"},
        json={
            "sender": {"name": "Sabor Domingo", "email": env("EMAIL_FROM")},
            "to": [{"email": addr} for addr in to],
            "subject": subject,
            "textContent": text,
        },
        timeout=10,
    )
    resp.raise_for_status()


def _admins() -> list[str]:
    return [a.strip() for a in env("ADMIN_EMAILS").split(",") if a.strip()]


def _items_text(items: list[dict]) -> str:
    return "\n".join(
        f"  {i['qty']}× {i['pack_size']}-meal pack · {i['dish_name']} — €{i['unit_price']}"
        for i in items)


def send_order_emails(order: dict, items: list[dict]) -> None:
    ref = f"#SD-{order['ref_num']}"

    _send(
        subject=f"Your Sabor Domingo order {ref} is confirmed",
        text=(
            f"Hola {order['name']},\n\n"
            f"Your order {ref} is confirmed. We cook on Monday and deliver on "
            f"{order['delivery_day']} evening.\n\nYour pack:\n{_items_text(items)}\n\n"
            f"Total: €{order['total']}\n\n"
            "Everything arrives chilled and portioned with reheating notes — "
            "fridge for 4 days, freezer for a month.\n\n"
            "Un apapacho,\nMaca & Clau"
        ),
        to=[order["email"]],
    )

    _send(
        subject=f"New order {ref} — {order['name']} ({order['delivery_day']})",
        text=(
            f"{order['name']} <{order['email']}>\n{order['address']}\n"
            f"Delivery: {order['delivery_day']}\nNotes: {order['notes'] or '—'}\n\n"
            f"{_items_text(items)}\n\nTotal: €{order['total']}"
        ),
        to=_admins(),
    )


def send_inquiry_notification(inquiry: dict) -> None:
    _send(
        subject=f"Event inquiry — {inquiry['name']} ({inquiry['type']})",
        text=(
            f"{inquiry['name']} <{inquiry['email']}>\nType: {inquiry['type']}\n"
            f"Guests: {inquiry.get('guests') or '—'}\n\n{inquiry.get('message') or ''}"
        ),
        to=_admins(),
    )
```

`api/_lib/webhook.py` — replace `on_order_paid`:
```python
def on_order_paid(order: dict, items: list[dict]) -> None:
    from api._lib.emails import send_order_emails
    try:
        send_order_emails(order, items)
    except Exception as e:  # email must never fail the webhook
        print(f"email send failed for order {order.get('id')}: {e}")
```

`api/index.py` — add:
```python
from pydantic import BaseModel, EmailStr, Field

from api._lib.db import get_client
from api._lib.emails import send_inquiry_notification


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
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api tests requirements.txt .env.example && git commit -m "feat: brevo emails and inquiry endpoint"
```

---

### Task 9: GET /api/py/order-status

**Files:**
- Create: `tests/test_order_status.py`
- Modify: `api/index.py`

**Interfaces:**
- Produces: `GET /api/py/order-status?session_id=cs_...` → 200 `{"status": "paid", "ref": "#SD-241", "delivery_day": "Monday", "total": 89}` (only these fields — session_id is the secret capability); 404 if unknown. Used by `/order/confirmed` page, which polls until status != `pending_payment` (webhook may lag redirect by seconds).

- [ ] **Step 1: Write failing tests**

`tests/test_order_status.py`:
```python
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import api.index as index
from api.index import app


def db_with(rows):
    client = MagicMock()
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.execute.return_value = MagicMock(data=rows)
    client.table.return_value = q
    return client


def test_found():
    rows = [{"status": "paid", "ref_num": 241, "delivery_day": "Monday", "total": 89}]
    with patch.object(index, "get_client", return_value=db_with(rows)):
        resp = TestClient(app).get("/api/py/order-status?session_id=cs_1")
    assert resp.status_code == 200
    assert resp.json() == {"status": "paid", "ref": "#SD-241",
                           "delivery_day": "Monday", "total": 89}


def test_unknown_404():
    with patch.object(index, "get_client", return_value=db_with([])):
        resp = TestClient(app).get("/api/py/order-status?session_id=cs_nope")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_order_status.py -q` — Expected: FAIL.

- [ ] **Step 3: Implement** — add to `api/index.py`:

```python
@app.get("/api/py/order-status")
def order_status(session_id: str):
    rows = (get_client().table("orders")
            .select("status, ref_num, delivery_day, total")
            .eq("stripe_session_id", session_id).execute().data)
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")
    o = rows[0]
    return {"status": o["status"], "ref": f"#SD-{o['ref_num']}",
            "delivery_day": o["delivery_day"], "total": o["total"]}
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api tests && git commit -m "feat: order status endpoint"
```

---

### Task 10: Frontend foundation — supabase client, types, landing shell

**Files:**
- Create: `lib/supabase.ts`, `lib/types.ts`, `lib/content.ts`, `app/globals.css` (replace), components `components/site/{Nav,Hero,Rhythm,Bios,Faq,Footer,EventsForm}.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`

**Interfaces:**
- Consumes: Supabase anon REST (public RLS reads).
- Produces:
  - `lib/supabase.ts`: `export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)` (plain supabase-js; no @supabase/ssr — admin session lives in browser localStorage, RLS is the security boundary).
  - `lib/types.ts`: `Dish { id, name, tag, description, available, image_path, sort_order }`, `Settings { price_4, price_10, order_fee, max_packs, open_day, close_day, cutoff_time, cook_day, delivery_days, delivery_window, delivery_area, window_override }`, `HeroContent`, `FaqEntry { q, a }`, `ImageSlots { hero, siblings, bio_maca, bio_clau }`.
  - `lib/content.ts`: `async function getSiteData()` → `{ dishes, settings, hero, faq, images }` — one server-side fetch used by `app/page.tsx` (server component, `export const revalidate = 60`).
  - `imageUrl(path: string | null): string | null` → `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${path}`; components fall back to `design-reference/assets` copies placed in `public/img/` when slot is null.

- [ ] **Step 1: Install supabase-js, copy placeholder assets**

```bash
npm install @supabase/supabase-js
mkdir -p public/img && cp design-reference/assets/*.png public/img/
```

- [ ] **Step 2: Write lib files** (code per Interfaces block above; `getSiteData` implementation):

```ts
// lib/content.ts
import { supabase } from "@/lib/supabase";
import type { Dish, FaqEntry, HeroContent, ImageSlots, Settings } from "@/lib/types";

export async function getSiteData() {
  const [dishes, settings, content] = await Promise.all([
    supabase.from("dishes").select("*").order("sort_order"),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("site_content").select("*"),
  ]);
  const byKey = Object.fromEntries((content.data ?? []).map((r) => [r.key, r.value]));
  return {
    dishes: (dishes.data ?? []) as Dish[],
    settings: settings.data as Settings,
    hero: byKey["hero"] as HeroContent,
    faq: (byKey["faq"] ?? []) as FaqEntry[],
    images: (byKey["images"] ?? {}) as ImageSlots,
  };
}

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${path}`;
}
```

- [ ] **Step 3: Port landing sections from the reference**

Source of truth for markup, copy, colors: `design-reference/sabor-standalone-src.html`. It uses inline styles (no classes) — convert mechanically to JSX `style` objects (`background:` → `background`, kebab-case → camelCase). Global styles (body background `#f6eee0`, link colors, marquee keyframes) go to `app/globals.css`. Sections → components: Nav, Hero (uses `hero` content + image slots), Rhythm (renders the week from `settings`: open/close/cook/delivery days), Bios (static copy from reference incl. Maca/Clau fact tables), Faq (from `faq` content), EventsForm (fields name/email/type/guests/message; POST to `/api/py/inquiry`; success message on `{ok:true}`), Footer. The pack-builder/order section is Task 11 — leave a `<div id="order" />` placeholder slot in `app/page.tsx` for now.

`app/page.tsx`:
```tsx
import { getSiteData } from "@/lib/content";
import Nav from "@/components/site/Nav";
import Hero from "@/components/site/Hero";
import Rhythm from "@/components/site/Rhythm";
import Bios from "@/components/site/Bios";
import Faq from "@/components/site/Faq";
import EventsForm from "@/components/site/EventsForm";
import Footer from "@/components/site/Footer";

export const revalidate = 60;

export default async function Home() {
  const data = await getSiteData();
  return (
    <main>
      <Nav />
      <Hero hero={data.hero} images={data.images} settings={data.settings} />
      <Rhythm settings={data.settings} />
      <div id="order" />
      <Bios images={data.images} />
      <EventsForm />
      <Faq faq={data.faq} />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 4: Verify visually**

`.env.local` with the two `NEXT_PUBLIC_*` vars. Run `npm run dev`, open `http://localhost:3000` — landing renders with seeded content, matches reference layout (compare against `design-reference/sabor-standalone-src.html` opened in browser). `npm run build` passes.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: landing page from supabase data"
```

---

### Task 11: Pack builder + checkout submit

**Files:**
- Create: `components/site/PackBuilder.tsx`
- Modify: `app/page.tsx` (replace `<div id="order" />`)

**Interfaces:**
- Consumes: `Dish[]`, `Settings` props; `POST /api/py/checkout` (Task 6 contract).
- Produces: client component (`"use client"`). State: `packSize: 4 | 10`, `cart: Record<dishId, qty>`, form fields, `submitting`, `error`. On submit → POST; on `{url}` → `window.location.href = url`; on 400/409 → show `detail` inline. Window-closed banner when `windowOpen` false (compute client-side for display only, server enforces for real).

- [ ] **Step 1: Build the component**

Port section "arma tu paquete / Build your meal pack" + "Your order" summary from the reference. Core logic:

```tsx
"use client";
import { useMemo, useState } from "react";
import type { Dish, Settings } from "@/lib/types";

export default function PackBuilder({ dishes, settings }: { dishes: Dish[]; settings: Settings }) {
  const [packSize, setPackSize] = useState<4 | 10>(10);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", email: "", address: "", notes: "" });
  const [deliveryDay, setDeliveryDay] = useState(settings.delivery_days[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packPrice = packSize === 4 ? settings.price_4 : settings.price_10;
  const totalPacks = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const subtotal = totalPacks * packPrice; // display only; server recomputes
  const total = totalPacks > 0 ? subtotal + settings.order_fee : 0;

  function add(dishId: string, delta: number) {
    setCart((c) => {
      const next = Math.max(0, (c[dishId] ?? 0) + delta);
      if (delta > 0 && totalPacks >= settings.max_packs) return c;
      const copy = { ...c, [dishId]: next };
      if (next === 0) delete copy[dishId];
      return copy;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const lines = Object.entries(cart).map(([dish_id, qty]) => ({
      dish_id, pack_size: packSize, qty,
    }));
    const res = await fetch("/api/py/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, ...form, delivery_day: deliveryDay }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
      return;
    }
    const body = await res.json().catch(() => ({ detail: "Something went wrong." }));
    setError(typeof body.detail === "string" ? body.detail : "Please check your details.");
    setSubmitting(false);
  }
  // ... markup ported from reference: pack size cards, dish rows with −/+,
  // order summary, delivery day select, name/address/email/notes inputs,
  // submit button "Pay €X — secured by Stripe", error box, closed-window banner
}
```

Simplification vs prototype (deliberate): one active pack size at a time (prototype cart keyed the same way). Card number fields from prototype are dropped — payment happens on Stripe.

- [ ] **Step 2: Wire into page** — replace `<div id="order" />` with `<PackBuilder dishes={data.dishes} settings={data.settings} />` (id="order" on the section root inside the component, nav anchor targets it).

- [ ] **Step 3: Verify manually**

With backend running (`npm run fastapi-dev` + `.env` carrying Supabase service key + Stripe **test** key + `SITE_URL=http://localhost:3000`): build a cart, submit, land on real Stripe test checkout page (don't pay yet). Empty cart → button disabled. Check window-closed banner by flipping `window_override` to `closed` in DB, reload.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: pack builder with stripe checkout redirect"
```

---

### Task 12: /order/confirmed page

**Files:**
- Create: `app/order/confirmed/page.tsx`

**Interfaces:**
- Consumes: `GET /api/py/order-status` (Task 9 contract).
- Produces: client page reading `session_id` from search params; polls order-status every 2s (max 10 tries) while `pending_payment`; renders: paid → confirmation (ref, delivery day, total, reheating note, "we confirm dishes Monday morning" copy from reference); cancelled → "payment didn't complete" + link back to `/#order`; still pending after retries → "payment processing, you'll get an email" fallback.

- [ ] **Step 1: Implement**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type OrderStatus = { status: string; ref: string; delivery_day: string; total: number };

function Confirmed() {
  const sessionId = useSearchParams().get("session_id");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [state, setState] = useState<"loading" | "paid" | "cancelled" | "pending" | "error">("loading");

  useEffect(() => {
    if (!sessionId) { setState("error"); return; }
    let tries = 0;
    let stop = false;
    async function poll() {
      while (!stop && tries < 10) {
        tries += 1;
        const res = await fetch(`/api/py/order-status?session_id=${sessionId}`);
        if (res.ok) {
          const o: OrderStatus = await res.json();
          setOrder(o);
          if (o.status === "paid") { setState("paid"); return; }
          if (o.status === "cancelled") { setState("cancelled"); return; }
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stop) setState("pending");
    }
    poll();
    return () => { stop = true; };
  }, [sessionId]);
  // markup: styled per reference palette (#f6eee0 bg, #c8492a accents)
}

export default function Page() {
  return <Suspense><Confirmed /></Suspense>;
}
```

(`useSearchParams` requires the Suspense wrapper in App Router — build fails without it.)

- [ ] **Step 2: Verify** — complete a Stripe test payment (card 4242 4242 4242 4242 or iDEAL test bank) from Task 11 flow; with Stripe CLI forwarding webhooks (`stripe listen --forward-to localhost:8000/api/py/stripe-webhook`, put printed `whsec_...` in `.env`): page shows paid state with ref. `npm run build` passes.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: order confirmation page with status polling"
```

---

### Task 13: Admin — auth + shell

**Files:**
- Create: `app/admin/page.tsx`, `components/admin/{Login,AdminShell}.tsx`

**Interfaces:**
- Consumes: `supabase.auth` (signInWithPassword, getSession, onAuthStateChange, signOut).
- Produces: `/admin` client page: no session → `<Login>` (email+password, error display); session → `<AdminShell>` with tab nav (`menu | settings | orders | images | content | inquiries`) + sign-out. Tab components arrive in Tasks 14–18; shell renders a registry `Record<TabKey, ComponentType>` so each later task adds one entry. Style: port admin look from reference (`view: 'admin'` markup in the dc script/state).

- [ ] **Step 1: Implement login + shell**

```tsx
// app/admin/page.tsx
"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Login from "@/components/admin/Login";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  return session ? <AdminShell /> : <Login />;
}
```

Login: form calling `supabase.auth.signInWithPassword({ email, password })`, show `error.message` on failure.

- [ ] **Step 2: Verify** — log in with a real admin user (created in Task 2) at `localhost:3000/admin`; wrong password shows error; sign-out returns to login. Session survives reload.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: admin auth and shell"
```

---

### Task 14: Admin — Menu tab

**Files:**
- Create: `components/admin/MenuTab.tsx`
- Modify: `components/admin/AdminShell.tsx` (register tab)

**Interfaces:**
- Consumes: `supabase.from("dishes")` as authenticated user (RLS admin policies).
- Produces: lists dishes by `sort_order`; per dish editable name, tag (select Meat/Vegetarian), description, available toggle; Save per dish (`update ... eq id`); saved/error feedback. This is the pattern template for Tasks 15/17 (fetch on mount → local state → save on click).

- [ ] **Step 1: Implement**

```tsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Dish } from "@/lib/types";

export default function MenuTab() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("dishes").select("*").order("sort_order")
      .then(({ data }) => setDishes((data ?? []) as Dish[]));
  }, []);

  function edit(id: string, patch: Partial<Dish>) {
    setDishes((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function save(d: Dish) {
    const { error } = await supabase.from("dishes")
      .update({ name: d.name, tag: d.tag, description: d.description, available: d.available })
      .eq("id", d.id);
    setStatus(error ? `Error: ${error.message}` : `Saved ${d.name}`);
  }
  // markup: card per dish with inputs bound via edit(), Save button per card
}
```

- [ ] **Step 2: Verify** — rename a dish in admin, reload landing page (revalidates ≤60s or restart dev), new name shows in pack builder. Logged-out REST write is refused (RLS): attempt update with anon key via curl → 0 rows.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: admin menu tab"
```

---

### Task 15: Admin — Settings tab

**Files:**
- Create: `components/admin/SettingsTab.tsx`
- Modify: `components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `supabase.from("settings")`, row id=1. Same fetch→edit→save pattern as MenuTab.
- Produces: form fields (exact list): price_4, price_10, order_fee (number inputs, step 0.5); max_packs (int); open_day, close_day, cook_day (selects Monday–Sunday); cutoff_time (time input, strip seconds on load: `value.slice(0,5)`); delivery_days (checkbox group Monday–Sunday → text[]); delivery_window (text); delivery_area (text); window_override (radio: auto/open/closed with labels "Automatic (Wed–Sun)"/"Force open"/"Force closed"). One Save button updating the whole row.

- [ ] **Step 1: Implement** (pattern from MenuTab; single row instead of list).
- [ ] **Step 2: Verify** — set `window_override=closed`, landing pack builder shows closed banner and `/api/py/checkout` returns 409 (curl). Set back to auto.
- [ ] **Step 3: Commit** — `git commit -m "feat: admin settings tab"`

---

### Task 16: Admin — Orders tab

**Files:**
- Create: `components/admin/OrdersTab.tsx`
- Modify: `components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `supabase.from("orders").select("*, order_items(*)")` (FK join), authenticated read-only.
- Produces: orders since last Wednesday 00:00 (client-computed date), status filter chips (paid default / pending_payment / cancelled / all), delivery-day filter, rows: `#SD-{ref_num}`, name, items summary (`qty× {pack_size}-meal · {dish_name}`), address, delivery_day, `€{total}`, status badge. Per-day pack counts summary line at top (what to cook Monday: dish → total packs across paid orders).

- [ ] **Step 1: Implement** (fetch with join, filters as local state, summary computed with reduce).
- [ ] **Step 2: Verify** — test order from Task 12 appears as paid with its items; pending/cancelled visible only under their filters.
- [ ] **Step 3: Commit** — `git commit -m "feat: admin orders tab"`

---

### Task 17: Admin — Images + Content tabs

**Files:**
- Create: `components/admin/ImagesTab.tsx`, `components/admin/ContentTab.tsx`
- Modify: `components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `supabase.storage.from("images")`, `site_content` rows `images` + `hero` + `faq`, `dishes.image_path`.
- Produces:
  - ImagesTab: slot list = named slots (hero, siblings, bio_maca, bio_clau) + one per dish. Per slot: current image preview (via `imageUrl`), file input → `supabase.storage.from("images").upload(\`${slot}-${Date.now()}.${ext}\`, file)` → write path into `site_content.images[slot]` (or `dishes.image_path`). Show upload errors.
  - ContentTab: hero title/subtitle/body inputs (updates `site_content` key `hero`); FAQ list editor (q + a textareas, add/remove entry, saves whole `faq` array).

- [ ] **Step 1: Implement ImagesTab** — upload code:

```tsx
async function uploadTo(slot: string, file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${slot}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("images").upload(path, file);
  if (error) { setStatus(`Upload failed: ${error.message}`); return; }
  // dish slots: slot === dish id → update dishes.image_path; else site_content.images
  await persistPath(slot, path);
  setStatus("Uploaded.");
}
```

- [ ] **Step 2: Implement ContentTab** (MenuTab pattern over `site_content` keys `hero`, `faq`).
- [ ] **Step 3: Verify** — upload an image to hero slot, landing shows it (revalidate); edit hero title, landing reflects it; broken file (e.g. >50MB) shows error not crash.
- [ ] **Step 4: Commit** — `git commit -m "feat: admin images and content tabs"`

---

### Task 18: Admin — Inquiries tab

**Files:**
- Create: `components/admin/InquiriesTab.tsx`
- Modify: `components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `supabase.from("inquiries")` (authenticated CRUD).
- Produces: list newest first: name, email (mailto link), type, guests, message, created_at; delete button per row.

- [ ] **Step 1: Implement** (fetch + delete, MenuTab pattern).
- [ ] **Step 2: Verify** — submit events form on landing → row appears in tab (+ admin email if Brevo key configured).
- [ ] **Step 3: Commit** — `git commit -m "feat: admin inquiries tab"`

---

### Task 19: Deploy to Vercel + Stripe/Brevo production wiring + E2E

**Files:**
- Create: `vercel.json` only if needed (template pattern usually needs none); `docs/runbook.md`

**Interfaces:**
- Consumes: everything.
- Produces: live preview + production deployment; configured webhooks; runbook for Maca & Clau handover.

- [ ] **Step 1: Vercel project**

```bash
npx vercel link   # or connect the GitHub repo in Vercel dashboard
```
Set all env vars from `.env.example` in Vercel (Production + Preview): Supabase pair ×2, Stripe test keys first, `BREVO_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, `SITE_URL` = deployment URL.

- [ ] **Step 2: Deploy + verify hybrid**

`npx vercel deploy` → check `https://<preview>/api/py/health` returns ok (Python function works), landing renders. If `api/_lib` imports fail on Vercel (bundling edge case): fallback is inlining `_lib` modules into `api/index.py` — but verify first, the underscore-dir pattern is the documented one.

- [ ] **Step 3: Stripe webhook endpoint**

Stripe dashboard (test mode) → Webhooks → add endpoint `https://<domain>/api/py/stripe-webhook`, events: `checkout.session.completed`, `checkout.session.expired`. Put signing secret in Vercel env `STRIPE_WEBHOOK_SECRET`. Redeploy.

- [ ] **Step 4: Full E2E in test mode**

Checklist: order 2 packs → iDEAL test payment → confirmed page shows ref → admin orders tab shows paid with correct totals → customer + admin emails received → duplicate webhook replay (Stripe dashboard "resend") does not duplicate emails → cancelled payment shows cancelled path → `window_override=closed` blocks checkout with banner + 409.

- [ ] **Step 5: Go-live switches (when Moritz says so, not before)**

Stripe live keys + live webhook endpoint + iDEAL enabled in live mode; `SITE_URL` to final domain; Brevo domain authentication for the sender domain (better deliverability; EMAIL_FROM stays an env var); custom domain in Vercel.

- [ ] **Step 6: Runbook + commit**

`docs/runbook.md`: how Maca & Clau update the weekly menu, flip the window override, read orders, where money appears (Stripe dashboard), what to do when an order must be refunded (Stripe dashboard refund + mark refunded in DB — v2 candidate). Commit everything.

---

## Self-Review (done at write time)

- **Spec coverage:** landing (T10), pack builder + checkout (T11, T6), confirmation (T12, T9), webhook truth (T7), admin menu/settings/orders/images/content/inquiries (T14–T18), auth (T13), emails (T8), schema/RLS (T2), deploy/E2E (T19). Deviation from spec, deliberate: inquiries insert via FastAPI instead of anon RLS insert (email notification needs a server hop) — RLS anon insert dropped.
- **Placeholder scan:** frontend markup steps intentionally reference `design-reference/sabor-standalone-src.html` as the markup/copy source rather than embedding ~70KB of JSX; logic code is embedded in full. FAQ copy in seed flagged as truncated — executor cross-checks reference.
- **Type consistency:** `Totals`/`Item` cents ints (T5) ↔ euro conversion at DB boundary (T6) ↔ `unit_price` euros in emails (T8); `ref_num` int → `#SD-` formatting in T8/T9/T16; env names uniform with Global Constraints.
