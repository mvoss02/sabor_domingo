-- Sides: "the first N per pack are free, the rest cost `price` each"
-- replaces the all-or-nothing included switch. Free units = free_per_pack ×
-- packs in the order; the server splits a side into an included line (€0)
-- and a paid line so every order line keeps one honest unit price.
alter table extras add column free_per_pack int not null default 0 check (free_per_pack >= 0);
-- Sides that were "included" stay free in any quantity the per-order cap
-- allows: max_qty free per pack is never fewer than max_qty per order.
update extras set free_per_pack = max_qty where included;
alter table extras drop column included;
