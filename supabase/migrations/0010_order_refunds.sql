-- One row per refund so the panel can show when, how much, why and by whom.
-- stripe_refund_id is unique: the panel's own refund and the later
-- charge.refunded webhook for it upsert the same row.
create table order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  stripe_refund_id text unique,
  amount numeric(8,2) not null,
  reason text not null default '',
  refunded_by text not null default '',
  created_at timestamptz not null default now()
);
create index order_refunds_order_idx on order_refunds (order_id);

alter table order_refunds enable row level security;
create policy "admin read order_refunds" on order_refunds for select to authenticated using (true);
