-- Store every meaning/part of speech under one headword and enforce one headword per deck.
alter table public.vocabulary_items
  add column if not exists senses jsonb not null default '[]'::jsonb;

update public.vocabulary_items
set senses = jsonb_build_array(jsonb_build_object(
  'sourceKey', source_key,
  'vietnamese', vietnamese,
  'partOfSpeech', part_of_speech,
  'tier', tier,
  'cefr', cefr,
  'ipa', ipa,
  'exampleEn', example_en,
  'exampleVi', example_vi,
  'notes', notes
))
where jsonb_array_length(senses) = 0;

create temporary table vocabulary_merge_map on commit drop as
with ranked as (
  select
    vocabulary.id as old_id,
    first_value(vocabulary.id) over (
      partition by vocabulary.user_id, vocabulary.deck_id,
        lower(regexp_replace(btrim(vocabulary.english), '\s+', ' ', 'g'))
      order by coalesce(card.memory_level, 0) desc,
        coalesce(card.stability, 0) desc,
        card.last_review_at desc nulls last,
        vocabulary.created_at,
        vocabulary.id
    ) as keeper_id
  from public.vocabulary_items vocabulary
  left join public.srs_cards card on card.vocabulary_id = vocabulary.id
)
select old_id, keeper_id from ranked;

create temporary table vocabulary_merged_values on commit drop as
with distinct_senses as (
  select distinct map.keeper_id, sense.value as sense
  from vocabulary_merge_map map
  join public.vocabulary_items vocabulary on vocabulary.id = map.old_id
  cross join lateral jsonb_array_elements(vocabulary.senses) sense
),
merged_senses as (
  select keeper_id, jsonb_agg(sense) as senses
  from distinct_senses
  group by keeper_id
),
merged_aliases as (
  select map.keeper_id, coalesce(array_agg(distinct accepted.alias) filter (where accepted.alias <> ''), '{}') as accepted_answers
  from vocabulary_merge_map map
  join public.vocabulary_items vocabulary on vocabulary.id = map.old_id
  left join lateral unnest(vocabulary.accepted_answers) as accepted(alias) on true
  group by map.keeper_id
),
merged_status as (
  select map.keeper_id,
    bool_or(vocabulary.status = 'active') as is_active,
    max(vocabulary.updated_at) as updated_at
  from vocabulary_merge_map map
  join public.vocabulary_items vocabulary on vocabulary.id = map.old_id
  group by map.keeper_id
)
select senses.keeper_id, senses.senses, aliases.accepted_answers,
  case when status.is_active then 'active' else 'archived' end as status,
  status.updated_at
from merged_senses senses
join merged_aliases aliases using (keeper_id)
join merged_status status using (keeper_id);

update public.vocabulary_items vocabulary
set senses = merged.senses,
  accepted_answers = merged.accepted_answers,
  status = merged.status,
  updated_at = merged.updated_at
from vocabulary_merged_values merged
where vocabulary.id = merged.keeper_id;

create temporary table vocabulary_card_merge on commit drop as
select
  card.id as card_id,
  map.keeper_id as keeper_vocabulary_id,
  row_number() over (
    partition by map.keeper_id
    order by card.memory_level desc, card.stability desc, card.last_review_at desc nulls last, card.updated_at desc, card.id
  ) as rank,
  sum(card.reps) over (partition by map.keeper_id) as total_reps,
  sum(card.lapses) over (partition by map.keeper_id) as total_lapses
from public.srs_cards card
join vocabulary_merge_map map on map.old_id = card.vocabulary_id;

delete from public.srs_cards card
using vocabulary_card_merge merged
where card.id = merged.card_id and merged.rank > 1;

update public.srs_cards card
set vocabulary_id = merged.keeper_vocabulary_id,
  reps = merged.total_reps,
  lapses = merged.total_lapses
from vocabulary_card_merge merged
where card.id = merged.card_id and merged.rank = 1;

update public.review_events review
set vocabulary_id = map.keeper_id
from vocabulary_merge_map map
where review.vocabulary_id = map.old_id and map.old_id <> map.keeper_id;

update public.learn_sessions session
set queue_ids = (
    select coalesce(array_agg(distinct coalesce(map.keeper_id, queue.id)), '{}')
    from unnest(session.queue_ids) as queue(id)
    left join vocabulary_merge_map map on map.old_id = queue.id
  ),
  deferred_ids = (
    select coalesce(array_agg(distinct coalesce(map.keeper_id, deferred.id)), '{}')
    from unnest(session.deferred_ids) as deferred(id)
    left join vocabulary_merge_map map on map.old_id = deferred.id
  );

update public.practice_sessions practice
set target_vocabulary_ids = (
  select coalesce(array_agg(distinct coalesce(map.keeper_id, target.id)), '{}')
  from unnest(practice.target_vocabulary_ids) as target(id)
  left join vocabulary_merge_map map on map.old_id = target.id
);

update public.practice_sessions practice
set content = jsonb_set(
  jsonb_set(
    practice.content,
    '{glossary}',
    coalesce((
      select jsonb_agg(
        case when map.keeper_id is null then item
          else jsonb_set(item, '{vocabularyId}', to_jsonb(map.keeper_id::text))
        end
      )
      from jsonb_array_elements(coalesce(practice.content->'glossary', '[]'::jsonb)) item
      left join vocabulary_merge_map map on map.old_id::text = item->>'vocabularyId'
    ), '[]'::jsonb)
  ),
  '{questions}',
  coalesce((
    select jsonb_agg(
      case when map.keeper_id is null then item
        else jsonb_set(item, '{vocabularyId}', to_jsonb(map.keeper_id::text))
      end
    )
    from jsonb_array_elements(coalesce(practice.content->'questions', '[]'::jsonb)) item
    left join vocabulary_merge_map map on map.old_id::text = item->>'vocabularyId'
  ), '[]'::jsonb)
);

delete from public.vocabulary_items vocabulary
using vocabulary_merge_map map
where vocabulary.id = map.old_id and map.old_id <> map.keeper_id;

update public.vocabulary_items
set source_key = lower(cefr) || ':' ||
  trim(both '-' from regexp_replace(lower(english), '[^a-z0-9]+', '-', 'g'))
where source = 'oxford-3000';

drop index if exists vocabulary_user_deck_headword_idx;
create unique index vocabulary_user_deck_headword_idx
  on public.vocabulary_items (
    user_id,
    deck_id,
    lower(regexp_replace(btrim(english), '\s+', ' ', 'g'))
  );

alter table public.vocabulary_items
  drop constraint if exists vocabulary_senses_nonempty;
alter table public.vocabulary_items
  add constraint vocabulary_senses_nonempty
  check (jsonb_typeof(senses) = 'array' and jsonb_array_length(senses) > 0);
