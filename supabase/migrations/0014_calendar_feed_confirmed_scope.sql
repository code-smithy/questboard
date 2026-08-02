-- Calendar subscription feeds should only expose confirmed events.

alter table public.calendar_feeds
  drop constraint if exists calendar_feeds_scope_check;

update public.calendar_feeds
set scope = 'confirmed'
where scope <> 'confirmed';

alter table public.calendar_feeds
  alter column scope set default 'confirmed';

alter table public.calendar_feeds
  add constraint calendar_feeds_scope_check check (scope = 'confirmed');

create or replace function public.ensure_own_calendar_feed(feed_scope text default 'confirmed')
returns public.calendar_feeds
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.calendar_feeds;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a calendar feed.';
  end if;

  insert into public.calendar_feeds (owner_id, scope)
  values (auth.uid(), 'confirmed')
  on conflict (owner_id) do update set
    scope = 'confirmed',
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
      scope = 'confirmed',
      is_active = true,
      last_accessed_at = null
  where owner_id = auth.uid()
  returning * into result;

  if found then
    return result;
  end if;

  return public.ensure_own_calendar_feed('confirmed');
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
  where gm.user_id = feed.owner_id
    and gm.archived_at is null
    and e.archived_at is null
    and e.status = 'confirmed'
  order by e.start_at asc;
end;
$$;
