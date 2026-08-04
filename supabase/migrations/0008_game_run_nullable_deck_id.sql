-- Drop NOT NULL constraint from deck_id in game_runs
ALTER TABLE public.game_runs ALTER COLUMN deck_id DROP NOT NULL;