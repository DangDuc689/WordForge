alter table public.srs_cards
  drop constraint if exists srs_cards_memory_level_check;
alter table public.srs_cards
  add constraint srs_cards_memory_level_check check (memory_level between 1 and 7);

alter table public.review_events
  drop constraint if exists review_events_rating_check;
alter table public.review_events
  add constraint review_events_rating_check check (rating between 1 and 7);
