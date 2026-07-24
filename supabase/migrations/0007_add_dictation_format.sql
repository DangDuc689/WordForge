alter table public.practice_sessions drop constraint if exists practice_sessions_format_check;
alter table public.practice_sessions add constraint practice_sessions_format_check check (format in ('reading', 'quiz', 'dialogue', 'dictation'));
