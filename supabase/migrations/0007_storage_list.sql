create policy "admin list images" on storage.objects for select to authenticated
  using (bucket_id = 'images');
