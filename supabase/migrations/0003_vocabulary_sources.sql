-- Track imported vocabulary packs and make their imports idempotent.
alter table public.decks
  add column if not exists source text not null default 'manual',
  add column if not exists source_key text not null default '';

alter table public.vocabulary_items
  add column if not exists source text not null default 'manual',
  add column if not exists source_key text not null default '';

alter table public.decks
  drop constraint if exists decks_source_check;
alter table public.decks
  add constraint decks_source_check check (source in ('manual', 'starter', 'oxford-3000'));

alter table public.vocabulary_items
  drop constraint if exists vocabulary_items_source_check;
alter table public.vocabulary_items
  add constraint vocabulary_items_source_check check (source in ('manual', 'starter', 'oxford-3000'));

create unique index if not exists decks_user_source_key_idx
  on public.decks(user_id, source, source_key)
  where source_key <> '';

create unique index if not exists vocabulary_user_source_key_idx
  on public.vocabulary_items(user_id, source, source_key)
  where source_key <> '';
