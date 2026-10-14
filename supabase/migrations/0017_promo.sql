-- Promotion: one campaign at a time, next to the quantity discount rule.
-- Stacks after the grams discount: percent takes `promo_value` % off the
-- guisos subtotal that is left once the grams discount is taken; amount
-- takes a flat €`promo_value` off the order (guisos + sides, after the grams
-- discount), capped so the total never drops below the order fee.
-- promo_active false switches it off without losing the configured text.
alter table settings add column promo_active boolean not null default false;
alter table settings add column promo_kind text not null default 'percent' check (promo_kind in ('percent', 'amount'));
alter table settings add column promo_value numeric(8,2) not null default 0 check (promo_value >= 0);
alter table settings add column promo_text text not null default '';
alter table settings add constraint settings_promo_percent_max check (promo_kind <> 'percent' or promo_value <= 100);

-- Frozen at checkout like `discount`; admin edits never re-run the promo.
alter table orders add column promo_discount numeric(8,2) not null default 0 check (promo_discount >= 0);
