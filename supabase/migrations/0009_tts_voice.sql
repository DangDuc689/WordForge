alter table public.profiles
  add column if not exists tts_voice text not null default 'en-US-EmmaMultilingualNeural';

alter table public.profiles
  drop constraint if exists profiles_tts_voice_check;

alter table public.profiles
  add constraint profiles_tts_voice_check check (tts_voice in (
    'en-US-EmmaMultilingualNeural',
    'en-US-AriaNeural',
    'en-GB-SoniaNeural'
  ));
