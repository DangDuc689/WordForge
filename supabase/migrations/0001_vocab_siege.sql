create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Saigon',
  new_words_per_session integer not null default 10 check (new_words_per_session between 1 and 50),
  desired_retention numeric not null default 0.90 check (desired_retention between 0.80 and 0.99),
  ai_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  english text not null,
  vietnamese text not null,
  accepted_answers text[] not null default '{}',
  part_of_speech text not null default 'other',
  tier smallint not null default 1 check (tier between 1 and 3),
  cefr text not null default '',
  ipa text not null default '',
  example_en text not null default '',
  example_vi text not null default '',
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.srs_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null unique references public.vocabulary_items(id) on delete cascade,
  due_at timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0 check (state between 0 and 3),
  last_review_at timestamptz,
  last_rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_items(id) on delete cascade,
  mode text not null,
  rating smallint not null check (rating between 1 and 4),
  correct boolean not null,
  response_ms integer,
  used_hint boolean not null default false,
  submitted_answer text not null default '',
  reviewed_at timestamptz not null default now()
);

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  score integer not null default 0,
  wave integer not null default 1,
  accuracy integer not null default 100,
  duration_seconds integer not null default 0,
  input_mode text not null check (input_mode in ('typing', 'touch')),
  created_at timestamptz not null default now()
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid references public.decks(id) on delete set null,
  format text not null check (format in ('reading', 'quiz')),
  target_vocabulary_ids uuid[] not null default '{}',
  content jsonb not null,
  score integer,
  created_at timestamptz not null default now()
);

create index if not exists vocabulary_user_deck_idx on public.vocabulary_items(user_id, deck_id, status);
create index if not exists srs_user_due_idx on public.srs_cards(user_id, due_at);
create index if not exists reviews_user_time_idx on public.review_events(user_id, reviewed_at desc);

alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.srs_cards enable row level security;
alter table public.review_events enable row level security;
alter table public.game_runs enable row level security;
alter table public.practice_sessions enable row level security;

create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "decks own rows" on public.decks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vocabulary own rows" on public.vocabulary_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cards own rows" on public.srs_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews own rows" on public.review_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "runs own rows" on public.game_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "practice own rows" on public.practice_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
