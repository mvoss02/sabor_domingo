-- The "how long does it keep" sentence, editable by the kitchen. Shown on the
-- rhythm section, the order-confirmed page and the confirmation email, so one
-- change updates every place the promise is made.
alter table settings add column storage_note text not null default 'fridge for 3 days, freezer for a month';
