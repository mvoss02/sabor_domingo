# Sabor Domingo — Design Spec

Date: 2026-09-01
Status: approved by Moritz (in-chat, section by section)

## What this is

Production web app for Sabor Domingo, a weekly Mexican meal-pack business in Amsterdam run by Maca and Clau. Customers order Wednesday → Sunday 22:00, food is cooked Monday, delivered Monday–Wednesday evenings. Menu (3 dishes) changes weekly.

A finished clickable prototype exists (Claude Design export, `Sabor Domingo landing page.zip`): landing page, pack builder, checkout, admin panel, events form. Visual design and copy are the reference; images are placeholders to be replaced later via admin. This spec covers turning the prototype into a real app.

## Stack (decided)

- **Frontend**: Next.js (React), on Vercel.
- **Backend**: FastAPI as Python serverless functions, same Vercel project (official Next.js + FastAPI pattern, rewrite `/api/py/*` → Python). Verify pattern at setup time.
- **Data/auth/files**: Supabase (Postgres, Auth, Storage).
- **Payments**: Stripe Checkout (hosted page), iDEAL + cards. Webhook confirms payment.
- **Email**: Resend free tier.

## Architecture

```
sabor_domingo/
├── app/            Next.js — landing, order flow, /admin
├── api/            FastAPI — checkout, Stripe webhook
└── supabase/       migrations, seed
```

Data flow rules:

- Browser reads `dishes`, `settings`, `site_content` directly from Supabase (public read via RLS). No cold start for page loads.
- Everything involving money or trust goes through FastAPI: checkout session creation, webhook processing. Server recomputes all prices from DB; client totals are display only.
- Admin UI writes menu/settings/content/images directly to Supabase as an authenticated user (RLS: authenticated role = admin; public signup disabled).

## Data model (Postgres)

- `dishes` — current week's menu, edited in place. Columns: id, name, tag (Meat/Vegetarian), description, available, sort_order.
- `settings` — singleton row: price_4, price_10, order_fee, max_packs, open_day, close_day, cutoff_time (22:00), cook_day, delivery_days[], delivery_window, delivery_area, window_override (open/closed/auto).
- `orders` — id, ref (human-readable, e.g. #SD-241, sequential), status (`pending_payment` → `paid`, or `cancelled` / `refunded`), name, email, address, notes, delivery_day, subtotal, fee, total, stripe_session_id, stripe_payment_intent, created_at.
- `order_items` — order_id, pack_size (4/10), dish_name (snapshot, not FK — menu changes weekly, history must survive), qty, unit_price.
- `site_content` — key (text) / value (jsonb). Editable copy: hero text, FAQ entries, image slot → storage path mapping.
- `inquiries` — events/business form: name, email, type, guests, message, created_at.
- Storage: one public-read bucket `images`.

RLS summary:

- anon: SELECT on dishes, settings, site_content; INSERT on inquiries.
- authenticated (= admin; two pre-created users, signup disabled): full CRUD on dishes, settings, site_content, inquiries; SELECT on orders/order_items.
- orders/order_items writes: service role only (FastAPI).

## Order flow (critical path)

1. Client builds cart → `POST /api/py/checkout` (cart, name, address, email, notes, delivery day).
2. FastAPI validates server-side:
   - order window open — computed from settings in Europe/Amsterdam timezone, never the client clock; `window_override` can force open/closed;
   - dishes exist and are available;
   - total packs ≤ max_packs;
   - recomputes subtotal/fee/total from DB prices.
3. Creates order (`pending_payment`) + Stripe Checkout Session (order id in metadata, iDEAL + card enabled), returns session URL.
4. Customer pays on Stripe's page, redirected to `/order/confirmed`.
5. Webhook `checkout.session.completed` → order `paid`, emails fire. `checkout.session.expired` → `cancelled`. **Webhook is the source of truth**, the redirect page only displays status.

Failure handling: webhook verifies Stripe signature; unknown/duplicate events are idempotent (status transitions only forward); orders stuck in `pending_payment` are visually separated in admin and expire via Stripe session expiry.

## Admin (`/admin`)

Supabase Auth login (email + password, two pre-created accounts). Tabs mirror prototype:

- **Menu** — edit the 3 dishes (name, tag, description, available).
- **Settings** — prices, order fee, max packs, order window days/cutoff, delivery days/window/area, manual open/close override.
- **Orders** — current orders list, filter by delivery day, shows items/address/total/status.
- **Images** — upload to Storage, assign to named slots (hero, dish photos, bio photos).
- **Content** — editable text fields (hero copy, FAQ).
- **Inquiries** — events/business submissions.

## Email (Resend)

On order `paid`: confirmation to customer (dishes, delivery day, reheating note), notification to Maca + Clau. Events inquiry: notification to Maca + Clau. Monday digest: deferred (orders tab covers it).

## Testing

- pytest on FastAPI: window computation (days, cutoff, timezone), price recomputation, tamper cases (forged client prices, unavailable dish, over max packs), webhook signature + idempotency.
- Stripe test mode; Stripe CLI forwards webhooks locally.
- Frontend: manual end-to-end pass in test mode (order → pay iDEAL test → webhook → admin shows paid → email received).

## Deploy

Vercel: preview deployments per branch, production on main. Secrets (Supabase service key, Stripe secret + webhook secret, Resend key) as Vercel env vars; anon key + URL public. Custom domain later.

## Out of scope (v1)

- Customer accounts / login
- Postcode/zone validation (area is displayed text; they handle edge cases via Instagram)
- Monday digest email
- Order editing/refunds in admin (done in Stripe dashboard)
- Multi-week menu scheduling (edit-in-place only)
