alter table orders
  add column phone text not null default '',
  add column postal_code text not null default '';
