-- Ensure calendar feed token generation can find pgcrypto on Supabase.

create or replace function public.make_calendar_feed_token()
returns text
language sql
volatile
set search_path = extensions, public, pg_catalog
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

alter table if exists public.calendar_feeds
  alter column token set default public.make_calendar_feed_token();
