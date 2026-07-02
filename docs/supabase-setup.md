# Supabase Setup

This document tracks the Phase 2 Supabase foundation for Questboard.

## Local or Hosted Project

Create a Supabase project, then apply the migrations in `supabase/migrations` in order:

1. `0001_initial_schema.sql` creates the core tables, constraints, indexes, timestamps, and auth profile trigger.
2. `0002_rls_policies.sql` enables RLS, adds shared authorization helper functions, defines initial policies, and exposes `public_event_cards` as the safe public event read model.
3. `0003_seed_default_categories.sql` automatically promotes each new group creator to `group_admin` and seeds the default categories.

## Discord OAuth

Configure Discord through both the Discord Developer Portal and Supabase Auth:

1. In **Supabase → Authentication → Sign In / Providers → Discord**, copy the provider **Callback URL**. It looks like `https://<project-ref>.supabase.co/auth/v1/callback` for a hosted project, or `http://localhost:54321/auth/v1/callback` for local Supabase.
2. In the **Discord Developer Portal → your application → OAuth2 → Redirects**, add that exact Supabase callback URL and save changes. Do not add the GitHub Pages app URL in Discord's redirects; Discord redirects back to Supabase first.
3. In **Discord Developer Portal → OAuth2 → Client information**, copy the numeric **Client ID** and **Client Secret**.
4. In **Supabase → Authentication → Sign In / Providers → Discord**, paste the Discord credentials and enable the provider. The Client ID must be the numeric Discord application ID, also called a snowflake (for example, `123456789012345678`), not the application name such as `questboard`.
5. In **Supabase → Authentication → URL Configuration**, set the site URL to the deployed Questboard origin and add the app callback route to the redirect allow list, for example `https://code-smithy.github.io/questboard/#/auth/callback`. For local Vite development, also allow `http://localhost:5173/#/auth/callback`.

If Discord shows `Invalid OAuth2 redirect_uri`, the Discord application's OAuth2 redirects are missing the Supabase callback URL from step 1 or the value does not match exactly.

If Discord authorization succeeds but Supabase redirects to `http://localhost:3000/?error=server_error...`, update **Supabase → Authentication → URL Configuration**. `http://localhost:3000` is Supabase's default site URL, so it means the deployed Questboard callback is not configured or not allowed. Set the site URL to `https://code-smithy.github.io/questboard` and add `https://code-smithy.github.io/questboard/#/auth/callback` to the redirect allow list, then try the login flow again.

If Supabase redirects back to Questboard with `Unable to exchange external code`, verify the Discord provider **Client Secret** in Supabase. That error happens after Discord authorization, when Supabase tries to exchange Discord's temporary authorization code for tokens. Regenerate the secret in the Discord Developer Portal if needed, paste the new value into Supabase, save the provider, and retry with a fresh login attempt.

The frontend expects these variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Copy `.env.example` to `.env.local` and fill the values before running the app.

## Security Notes

- The static frontend is not trusted; all group and event access must go through RLS.
- Public event listing should use `public_event_cards`, not direct reads from `events`, so unauthenticated users only receive safe event fields and attendance counts.
- Archived records are kept for history and hidden by default through application queries.
- Invite links are reusable by default and constrained by `expires_at`, `max_uses`, `used_count`, and `is_active`.
