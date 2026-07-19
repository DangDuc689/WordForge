-- Migration to create learn_sessions table to store user learning states
create table if not exists public.learn_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_deck_id uuid references public.decks(id) on delete set null,
  queue_ids uuid[] not null default '{}',
  deferred_ids uuid[] not null default '{}',
  status text not null default 'idle' check (status in ('idle', 'active', 'completed')),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.learn_sessions enable row level security;

-- Add RLS policy for the current user
create policy "sessions own row" on public.learn_sessions 
  for all 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);
