-- Minimum order in euros, compared with the subtotal BEFORE discounts and
-- without the fee (guisos + sides at list price): "order at least €X of food".
-- Promotions and the grams discount never push a cart under it. 0 = off.
alter table settings add column min_order numeric(8,2) not null default 0 check (min_order >= 0);
