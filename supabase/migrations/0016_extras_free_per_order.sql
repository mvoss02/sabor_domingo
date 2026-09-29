-- Sides: an explicit "N free per order" next to "N free per pack". The two
-- are mutually exclusive; the check keeps a row from carrying both.
-- free = per_order > 0 ? min(qty, per_order) : min(qty, per_pack × packs, max_free)
alter table extras add column free_per_order int not null default 0 check (free_per_order >= 0);
alter table extras add constraint extras_free_mode_exclusive check (not (free_per_pack > 0 and free_per_order > 0));
