-- Private calendar subscription feeds.

create or replace function public.make_calendar_feed_token()
returns text
language sql
volatile
set search_path = extensions, public, pg_catalog
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique default public.make_calendar_feed_token(),
  scope text not null default 'rsvp' check (scope in ('rsvp', 'visible')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  unique (owner_id)
);

create index if not exists calendar_feeds_token_active_idx on public.calendar_feeds (token) where is_active;
create index if not exists calendar_feeds_owner_id_idx on public.calendar_feeds (owner_id);

drop trigger if exists set_calendar_feeds_updated_at on public.calendar_feeds;
create trigger set_calendar_feeds_updated_at
before update on public.calendar_feeds
for each row execute function public.set_updated_at();

alter table public.calendar_feeds enable row level security;

drop policy if exists "Users can read their own calendar feeds" on public.calendar_feeds;
create policy "Users can read their own calendar feeds"
on public.calendar_feeds for select
to authenticated
using (owner_id = auth.uid() or public.is_site_admin());

drop policy if exists "Users can update their own calendar feeds" on public.calendar_feeds;
create policy "Users can update their own calendar feeds"
on public.calendar_feeds for update
to authenticated
using (owner_id = auth.uid() or public.is_site_admin())
with check (owner_id = auth.uid() or public.is_site_admin());

create or replace function public.ensure_own_calendar_feed(feed_scope text default 'rsvp')
returns public.calendar_feeds
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.calendar_feeds;
  normalized_scope text := coalesce(feed_scope, 'rsvp');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a calendar feed.';
  end if;

  if normalized_scope not in ('rsvp', 'visible') then
    raise exception 'Unsupported calendar feed scope.';
  end if;

  insert into public.calendar_feeds (owner_id, scope)
  values (auth.uid(), normalized_scope)
  on conflict (owner_id) do update set
    scope = excluded.scope,
    is_active = true,
    token = case
      when public.calendar_feeds.is_active then public.calendar_feeds.token
      else public.make_calendar_feed_token()
    end
  returning * into result;

  return result;
end;
$$;

create or replace function public.regenerate_own_calendar_feed()
returns public.calendar_feeds
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.calendar_feeds;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to regenerate a calendar feed.';
  end if;

  update public.calendar_feeds
  set token = public.make_calendar_feed_token(),
      is_active = true,
      last_accessed_at = null
  where owner_id = auth.uid()
  returning * into result;

  if found then
    return result;
  end if;

  return public.ensure_own_calendar_feed('rsvp');
end;
$$;

create or replace function public.disable_own_calendar_feed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to disable a calendar feed.';
  end if;

  update public.calendar_feeds
  set is_active = false,
      token = public.make_calendar_feed_token()
  where owner_id = auth.uid();
end;
$$;

create or replace function public.get_calendar_feed_events(feed_token text)
returns table (
  id uuid,
  title text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  timezone text,
  status text,
  recurrence_rule text,
  updated_at timestamptz,
  location_text text,
  online_details jsonb,
  group_name text,
  category_name text,
  location_name text,
  location_address text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  feed public.calendar_feeds;
begin
  select *
  into feed
  from public.calendar_feeds
  where token = feed_token
    and is_active;

  if not found then
    return;
  end if;

  update public.calendar_feeds as cf
  set last_accessed_at = now()
  where cf.id = feed.id;

  return query
  select
    e.id,
    e.title,
    e.description,
    e.start_at,
    e.end_at,
    e.timezone,
    e.status,
    e.recurrence_rule,
    e.updated_at,
    e.location_text,
    e.online_details,
    g.name as group_name,
    c.name as category_name,
    l.name as location_name,
    l.address as location_address
  from public.events e
  join public.groups g on g.id = e.group_id
  join public.group_members gm on gm.group_id = e.group_id
  left join public.categories c on c.id = e.category_id
  left join public.locations l on l.id = e.location_id
  left join public.event_rsvps r on r.event_id = e.id and r.user_id = feed.owner_id
  where gm.user_id = feed.owner_id
    and gm.archived_at is null
    and e.archived_at is null
    and e.status in ('open', 'confirmed', 'cancelled')
    and (
      feed.scope = 'visible'
      or r.status in ('attending', 'maybe')
    )
  order by e.start_at asc;
end;
$$;

grant execute on function public.ensure_own_calendar_feed(text) to authenticated;
grant execute on function public.regenerate_own_calendar_feed() to authenticated;
grant execute on function public.disable_own_calendar_feed() to authenticated;
grant execute on function public.get_calendar_feed_events(text) to anon, authenticated;
