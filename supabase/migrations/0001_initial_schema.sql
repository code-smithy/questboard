-- Questboard initial Supabase schema.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_user_id text unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  is_site_admin boolean not null default false
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  theme text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'regular' check (role in ('group_admin', 'regular')),
  joined_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  color text not null default '#f0b35a',
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  address text,
  latitude numeric,
  longitude numeric,
  map_url text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'UTC',
  mode text not null default 'offline' check (mode in ('online', 'offline', 'hybrid')),
  location_id uuid references public.locations (id) on delete set null,
  location_text text,
  online_details jsonb not null default '{}'::jsonb,
  minimum_attendees integer not null default 1 check (minimum_attendees >= 0),
  maximum_attendees integer check (maximum_attendees is null or maximum_attendees > 0),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  status text not null default 'open' check (status in ('draft', 'open', 'confirmed', 'cancelled', 'archived')),
  recurrence_rule text,
  recurrence_parent_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_at >= start_at),
  check (maximum_attendees is null or maximum_attendees >= minimum_attendees)
);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('attending', 'maybe', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.event_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  change_type text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  remind_at timestamptz not null,
  method text not null default 'in_app' check (method in ('in_app', 'browser')),
  is_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, remind_at, method)
);

create index profiles_discord_user_id_idx on public.profiles (discord_user_id);
create index group_members_user_id_idx on public.group_members (user_id) where archived_at is null;
create index group_members_group_id_idx on public.group_members (group_id) where archived_at is null;
create index group_invites_token_idx on public.group_invites (token) where is_active;
create index categories_group_id_sort_order_idx on public.categories (group_id, sort_order);
create index locations_group_id_idx on public.locations (group_id) where archived_at is null;
create index events_group_start_idx on public.events (group_id, start_at) where archived_at is null;
create index events_public_start_idx on public.events (start_at) where visibility = 'public' and archived_at is null;
create index event_rsvps_event_id_idx on public.event_rsvps (event_id);
create index event_comments_event_id_idx on public.event_comments (event_id) where archived_at is null;
create index event_history_event_id_created_at_idx on public.event_history (event_id, created_at desc);
create index event_reminders_user_due_idx on public.event_reminders (user_id, remind_at) where not is_sent;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger set_event_rsvps_updated_at
before update on public.event_rsvps
for each row execute function public.set_updated_at();

create trigger set_event_comments_updated_at
before update on public.event_comments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, discord_user_id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email, 'New adventurer'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    discord_user_id = excluded.discord_user_id,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    last_seen_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
