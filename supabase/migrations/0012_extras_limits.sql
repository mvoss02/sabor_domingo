-- Sides: explicit included-vs-priced switch (instead of "€0 means included"),
-- a per-side cap per order, and a global cap on sides per order.
alter table extras add column included boolean not null default true;
alter table extras add column max_qty int not null default 5 check (max_qty > 0);
alter table settings add column max_extras int not null default 10 check (max_extras > 0);
