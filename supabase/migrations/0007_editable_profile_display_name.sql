-- Keep a Discord-synced display value separate from the user-editable shown name.

alter table public.profiles
add column if not exists synced_display_name text;

update public.profiles
set synced_display_name = display_name
where synced_display_name is null;

alter table public.profiles
alter column synced_display_name set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.email,
    'New adventurer'
  );
begin
  insert into public.profiles (id, discord_user_id, display_name, synced_display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    synced_name,
    synced_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    discord_user_id = excluded.discord_user_id,
    synced_display_name = excluded.synced_display_name,
    avatar_url = excluded.avatar_url,
    last_seen_at = now();

  return new;
end;
$$;
