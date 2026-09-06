-- Refunds: money only ever moves through Stripe (api/_lib/refunds.py and the
-- charge.refunded webhook). `total` stays what the customer originally paid;
-- `refunded_total` accumulates what went back. Status flips to 'refunded'
-- only when everything is back; a partial refund leaves it 'paid'.
alter table orders add column refunded_total numeric(8,2) not null default 0;

-- Admin edits (address, phone, notes, delivery day, item quantities) go
-- straight from the panel through RLS, like dishes/settings already do.
-- Inserts stay backend-only: orders are only ever created by checkout.
create policy "admin update orders" on orders for update to authenticated using (true) with check (true);
create policy "admin update order_items" on order_items for update to authenticated using (true) with check (true);
create policy "admin delete order_items" on order_items for delete to authenticated using (true);
