alter table dishes enable row level security;
alter table settings enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table site_content enable row level security;
alter table inquiries enable row level security;

-- public reads
create policy "public read dishes" on dishes for select using (true);
create policy "public read settings" on settings for select using (true);
create policy "public read content" on site_content for select using (true);

-- admins (any authenticated user; signup disabled)
create policy "admin write dishes" on dishes for all to authenticated using (true) with check (true);
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);
create policy "admin write content" on site_content for all to authenticated using (true) with check (true);
create policy "admin read orders" on orders for select to authenticated using (true);
create policy "admin read order_items" on order_items for select to authenticated using (true);
create policy "admin all inquiries" on inquiries for all to authenticated using (true) with check (true);

-- storage: public read via public bucket; admin write
create policy "admin upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'images');
create policy "admin update images" on storage.objects for update to authenticated
  using (bucket_id = 'images');
create policy "admin delete images" on storage.objects for delete to authenticated
  using (bucket_id = 'images');
