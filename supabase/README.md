# Supabase setup

1. Create a Supabase project and run `supabase db push` to apply migrations 0001–0009.
2. Enable Email OTP/magic-link and disable public sign-up; invite the owner email.
3. In Storage, create a public bucket named `tts-cache`. Restrict it to `audio/mpeg` and a 5 MB maximum file size. The browser must not receive a service/secret key; only the Edge Function writes to this bucket.
4. Deploy all three functions with the Supabase CLI:

```sh
supabase functions deploy ai-enrich-vocabulary
supabase functions deploy ai-generate-practice
supabase functions deploy tts-synthesize
```

5. Set secrets:

```sh
supabase secrets set GEMINI_API_KEY=your_key GEMINI_MODEL=gemini-3.5-flash-lite
```

The browser only receives the publishable key. Gemini credentials stay in Edge Function secrets.

`edge-tts-universal` is pinned in the TTS function and uses Microsoft's Edge online TTS protocol without an Azure Speech key. It is an AGPL-3.0 dependency; review its license and upstream-service terms before making this app public.
