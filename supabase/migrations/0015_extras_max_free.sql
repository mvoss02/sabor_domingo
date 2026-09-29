-- Cap on free side units per order: free = min(qty, free_per_pack × packs,
-- max_free). Tortillas can be "1 per pack, at most 3"; a flat "1 per order"
-- is free_per_pack 1 with max_free 1. 0 means no cap.
alter table extras add column max_free int not null default 0 check (max_free >= 0);
