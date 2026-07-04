-- Archive guilds through an admin-only RPC and keep archived guilds out of active reads.

create or replace function public.is_group_member(check_group_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = check_group_id
      and gm.user_id = check_user_id
      and gm.archived_at is null
      and g.archived_at is null
  );
$$;

create or replace function public.is_group_admin(check_group_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = check_group_id
      and gm.user_id = check_user_id
      and gm.role = 'group_admin'
      and gm.archived_at is null
      and g.archived_at is null
  );
$$;

drop policy if exists "Users can read profiles shared through groups" on public.profiles;
create policy "Users can read profiles shared through groups"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.group_members mine
    join public.groups g on g.id = mine.group_id
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid()
      and theirs.user_id = profiles.id
      and mine.archived_at is null
      and theirs.archived_at is null
      and g.archived_at is null
  )
  or public.is_site_admin()
);

create or replace function public.archive_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to archive a guild.';
  end if;

  if not (public.is_group_admin(target_group_id, auth.uid()) or public.is_site_admin()) then
    raise exception 'Only guild admins can archive this guild.';
  end if;

  update public.groups
  set archived_at = now()
  where id = target_group_id
    and archived_at is null;

  if not found then
    raise exception 'Guild was not found or is already archived.';
  end if;

  update public.group_invites
  set is_active = false
  where group_id = target_group_id
    and is_active;
end;
$$;

grant execute on function public.archive_group(uuid) to authenticated;

create or replace function public.accept_group_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.group_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to accept an invite.';
  end if;

  select i.*
  into target_invite
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.token = invite_token
    and i.is_active
    and g.archived_at is null
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.used_count < i.max_uses)
  for update of i;

  if not found then
    raise exception 'Invite is invalid, expired, inactive, or fully used.';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_invite.group_id, auth.uid(), 'regular')
  on conflict (group_id, user_id) do update set
    archived_at = null;

  update public.group_invites
  set used_count = used_count + 1
  where id = target_invite.id;

  return target_invite.group_id;
end;
$$;

grant execute on function public.accept_group_invite(text) to authenticated;

create or replace view public.public_event_cards
with (security_barrier = true)
as
select
  e.id,
  e.title,
  e.description,
  e.start_at,
  e.end_at,
  e.timezone,
  e.mode,
  e.location_text,
  e.online_details,
  e.minimum_attendees,
  e.maximum_attendees,
  e.status,
  e.group_id,
  g.name as group_name,
  c.name as category_name,
  c.color as category_color,
  c.icon as category_icon,
  count(r.id) filter (where r.status = 'attending')::integer as attending_count
from public.events e
join public.groups g on g.id = e.group_id
left join public.categories c on c.id = e.category_id
left join public.event_rsvps r on r.event_id = e.id
where e.visibility = 'public'
  and e.archived_at is null
  and g.archived_at is null
  and e.status in ('open', 'confirmed')
group by e.id, g.name, c.name, c.color, c.icon;

grant select on public.public_event_cards to anon, authenticated;
