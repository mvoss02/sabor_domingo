-- Each order is frozen to the calendar date it gets cooked on. The admin
-- "Orders" view groups by this instead of by delivery weekday name, which
-- was ambiguous across weeks. The backend computes it at checkout
-- (api/_lib/window.py cook_date_for); this migration backfills existing
-- rows with the same rule against the current settings row.

alter table orders add column cook_date date;

create or replace function _backfill_cook_date(t timestamptz) returns date
language plpgsql as $$
declare
  s settings%rowtype;
  days text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  local_ts timestamp;
  today date;
  close_i int;
  cook_i int;
  close_d date;
begin
  select * into s from settings where id = 1;
  local_ts := t at time zone 'Europe/Amsterdam';
  today := local_ts::date;
  close_i := array_position(days, s.close_day) - 1;  -- 0 = Monday, like Python weekday()
  cook_i := array_position(days, s.cook_day) - 1;

  close_d := today + ((close_i - (extract(isodow from today)::int - 1) + 7) % 7);
  if close_d = today and local_ts::time >= s.cutoff_time then
    close_d := close_d + 7;
  end if;

  return close_d + ((cook_i - (extract(isodow from close_d)::int - 1) + 7) % 7);
end;
$$;

update orders set cook_date = _backfill_cook_date(created_at) where cook_date is null;

drop function _backfill_cook_date(timestamptz);

alter table orders alter column cook_date set not null;
create index orders_cook_date_idx on orders (cook_date);
