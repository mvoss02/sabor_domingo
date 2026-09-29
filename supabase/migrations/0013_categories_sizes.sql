-- Menu rework: two dish categories (The Classics / Chef's Favourites) with
-- their own prices, pack sizes as rows instead of the fixed 4/10-meal packs,
-- a protein tag per dish, optional nutrition, and a grams-based discount.

-- ---- Pack sizes (El Chico 400 g, El Grande 750 g) with a price per category.
-- Sizes are rows so the admin can rename, resize or add one. The two dish
-- categories are fixed, so their prices live as columns on the size row
-- instead of a separate price matrix.
create table pack_sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grams int not null check (grams > 0),
  serves text not null default '',
  price_classic numeric(8,2) not null check (price_classic > 0),
  price_chef numeric(8,2) not null check (price_chef > 0),
  sort_order int not null default 0
);

alter table pack_sizes enable row level security;
create policy "public read pack_sizes" on pack_sizes for select using (true);
create policy "admin write pack_sizes" on pack_sizes for all to authenticated using (true) with check (true);

insert into pack_sizes (name, grams, serves, price_classic, price_chef, sort_order) values
  ('El Chico',  400, 'serves 1–2', 13.50, 17.50, 0),
  ('El Grande', 750, 'serves 3–4', 22.50, 29.50, 1);

-- ---- Settings: the two flat pack prices go away; the discount rule comes in.
-- Discount applies to the guisos subtotal only (not sides, not the fee) once
-- the order's total grams are strictly above the threshold. pct = 0 turns it off.
alter table settings drop constraint positive_prices;
alter table settings drop column price_4;
alter table settings drop column price_10;
-- max_packs / max_extras = 0 means no limit per order.
alter table settings add constraint positive_prices check (order_fee >= 0 and max_packs >= 0);
alter table settings drop constraint settings_max_extras_check;
alter table settings add constraint settings_max_extras_check check (max_extras >= 0);

alter table settings add column discount_threshold_grams int not null default 2000 check (discount_threshold_grams >= 0);
alter table settings add column discount_pct numeric(5,2) not null default 3 check (discount_pct >= 0 and discount_pct <= 100);
alter table settings add column discount_hint text not null default 'Order more than 2 kg of guisos and get 3% off.';

-- ---- Dishes: category, protein tag, optional nutrition per 100 g.
-- The old check (Meat/Vegetarian) is live until dropped, so: drop it, remap
-- the rows, then add the new one. Fix the real protein in the admin Menu tab.
alter table dishes drop constraint dishes_tag_check;
update dishes set tag = 'Beef'   where tag = 'Meat';
update dishes set tag = 'Veggie' where tag = 'Vegetarian';
alter table dishes add constraint dishes_tag_check check (tag in ('Chicken', 'Pork', 'Beef', 'Veggie', 'Vegan'));

alter table dishes add column category text not null default 'classic' check (category in ('classic', 'chef'));
-- {energy_kcal, fat, saturates, carbs, sugars, protein, salt}, all optional.
alter table dishes add column nutrition jsonb;

-- ---- Order lines snapshot the size (name + grams) as well as the dish name
-- and price, so later menu edits never rewrite what a customer bought.
-- pack_size now holds grams; the old 4/10 lines keep their values.
alter table order_items add column size_name text not null default '';
update order_items set size_name = pack_size || '-meal pack' where kind = 'pack' and pack_size in (4, 10);
alter table order_items drop constraint order_items_pack_size_check;
alter table order_items add constraint order_items_pack_size_check check (
  (kind = 'pack' and pack_size > 0) or (kind = 'extra' and pack_size is null)
);

-- ---- Orders: the discount granted at checkout, frozen there. Admin edits
-- settle the difference between paid and owed; they never re-run the rule.
alter table orders add column discount numeric(8,2) not null default 0 check (discount >= 0);
