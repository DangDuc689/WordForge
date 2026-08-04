# Supabase setup

1. Create a Supabase project and run `supabase db push` to apply migrations 0001–0008.
2. Enable Email OTP/magic-link and disable public sign-up; invite the owner email.
3. Deploy both functions with the Supabase CLI.
4. Set secrets:

```sh
supabase secrets set GEMINI_API_KEY=your_key GEMINI_MODEL=gemini-3.5-flash-lite
```

The browser only receives the publishable key. Gemini credentials stay in Edge Function secrets.
