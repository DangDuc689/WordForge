-- Replace FSRS ratings with the six fixed memory levels.
alter table public.srs_cards
  add column if not exists memory_level smallint;

update public.srs_cards
set memory_level = case
  when last_rating = 4 then 6
  when last_rating = 3 then 4
  when last_rating = 2 then 2
  else 1
end
where memory_level is null;

alter table public.srs_cards
  alter column memory_level set default 1,
  alter column memory_level set not null;

alter table public.srs_cards
  drop constraint if exists srs_cards_memory_level_check;
alter table public.srs_cards
  add constraint srs_cards_memory_level_check check (memory_level between 1 and 6);

update public.srs_cards
set last_rating = memory_level
where last_rating is not null;

update public.review_events
set rating = case
  when rating = 4 then 6
  when rating = 3 then 4
  when rating = 2 then 2
  else 1
end;

alter table public.review_events
  drop constraint if exists review_events_rating_check;
alter table public.review_events
  add constraint review_events_rating_check check (rating between 1 and 6);
