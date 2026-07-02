# Supabase Setup

This document tracks the Phase 2 Supabase foundation for Questboard.

## Local or Hosted Project

Create a Supabase project, then apply the migrations in `supabase/migrations` in order:

1. `0001_initial_schema.sql` creates the core tables, constraints, indexes, timestamps, and auth profile trigger.
2. `0002_rls_policies.sql` enables RLS, adds shared authorization helper functions, defines initial policies, and exposes `public_event_cards` as the safe public event read model.
3. `0003_seed_default_categories.sql` automatically promotes each new group creator to `group_admin` and seeds the default categories.

## Discord OAuth

Configure Discord as a Supabase Auth provider and set the application callback URL to the deployed Questboard origin. For local development, also allow the Vite dev origin.

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
