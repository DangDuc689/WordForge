alter table public.practice_sessions drop constraint if exists practice_sessions_format_check;
alter table public.practice_sessions add constraint practice_sessions_format_check check (format in ('reading', 'quiz', 'dialogue'));
alter table public.practice_sessions add column if not exists answers jsonb;
alter table public.practice_sessions add column if not exists completed_at timestamptz;
