alter table public.vocabulary_items
add column if not exists is_prioritized boolean not null default false;
