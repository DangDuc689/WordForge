# Supabase setup

1. Create a Supabase project and run `supabase db push` to apply migrations 0001–0003.
2. Enable Email OTP/magic-link and disable public sign-up; invite the owner email.
3. Deploy both functions with the Supabase CLI.
4. Set secrets:

```sh
supabase secrets set GROQ_API_KEY=your_key GROQ_MODEL=openai/gpt-oss-20b
```

The browser only receives the publishable key. Groq credentials stay in Edge Function secrets.
