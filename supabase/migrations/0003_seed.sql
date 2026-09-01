insert into dishes (name, tag, description, sort_order) values
  ('Meat dish one', 'Meat', 'Placeholder — a slow-cooked beef or pork guiso from San Luis Potosí. Rename in admin each week.', 0),
  ('Meat dish two', 'Meat', 'Placeholder — a chicken dish in a red or green salsa. Rename in admin each week.', 1),
  ('Vegetarian dish', 'Vegetarian', 'Placeholder — a mushroom, nopal or bean guiso. Rename in admin each week.', 2);

insert into settings (id, price_4, price_10, order_fee, max_packs,
  open_day, close_day, cutoff_time, cook_day, delivery_days,
  delivery_window, delivery_area, window_override)
values (1, 39, 85, 4, 5,
  'Wednesday', 'Sunday', '22:00', 'Monday', array['Monday','Tuesday','Wednesday'],
  '17:00 – 19:00', 'Amsterdam within the ring', 'auto');

insert into site_content (key, value) values
  ('hero',   jsonb_build_object('title', 'A little apapacho from Mexico.', 'subtitle', 'como en casa, but in Amsterdam', 'body', 'Home-cooked meal packs from a real Mexican kitchen — ours. You order during the week, we cook everything fresh on Monday, and it arrives at your door ready to warm up.')),
  ('images', jsonb_build_object('hero', null, 'siblings', null, 'bio_maca', null, 'bio_clau', null)),
  ('faq',    (select jsonb_agg(jsonb_build_object('q', q, 'a', a)) from (values
    ('Where do you deliver?', 'Amsterdam within the ring, Monday to Wednesday evenings. Just outside? Message us on Instagram — we sometimes make it work.'),
    ('How do I reheat it?', 'Everything arrives chilled and portioned. Pan with a splash of water, or microwave. Fridge for 4 days, freezer for a month.'),
    ('Is it very spicy?', 'The dishes are mild — the heat lives in the salsa, which comes separate so you decide. Maca will still try to talk you into the spiciest one.'),
    ('Can I change my order?', 'Until Sunday 22:00, yes — message us and we adjust or refund. After that your ingredients are already bought.')
  ) as t(q, a)));
