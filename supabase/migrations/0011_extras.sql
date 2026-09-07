-- Step 3 of the pack builder: sides/extras (tortillas, salsas, garnishes).
-- Priced per unit; €0 means "included". Sold-out items stay visible but
-- greyed on the site (available = false), same as dishes from now on.
create table extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(8,2) not null default 0 check (price >= 0),
  available boolean not null default true,
  image_path text,
  sort_order int not null default 0
);

alter table extras enable row level security;
create policy "public read extras" on extras for select using (true);
create policy "admin write extras" on extras for all to authenticated using (true) with check (true);

-- Extras ride along as order lines next to the packs, so refunds, edits,
-- emails and the cook summary all see them. pack_size only applies to packs.
alter table order_items add column kind text not null default 'pack' check (kind in ('pack', 'extra'));
alter table order_items drop constraint order_items_pack_size_check;
alter table order_items alter column pack_size drop not null;
alter table order_items add constraint order_items_pack_size_check check (
  (kind = 'pack' and pack_size in (4, 10)) or (kind = 'extra' and pack_size is null)
);

-- Starter list; set real prices in the admin Menu tab.
insert into extras (name, description, price, sort_order) values
  ('Tortillas · maiz',  'Corn tortillas, the classic.', 0, 0),
  ('Tortillas · flour', 'Soft flour tortillas.', 0, 1),
  ('Salsa roja',        'Roasted tomato and chile. Medium heat.', 0, 2),
  ('Salsa verde',       'Tomatillo, coriander, a little kick.', 0, 3),
  ('Lime wedges',       '', 0, 4),
  ('Coriander',         'Fresh, chopped.', 0, 5),
  ('Pickled onions',    'Red onion, lime, oregano.', 0, 6);
