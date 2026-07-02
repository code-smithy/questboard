-- Questboard row-level security policies.

create or replace function public.is_site_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and is_site_admin
  );
$$;

create or replace function public.is_group_member(check_group_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = check_group_id
      and user_id = check_user_id
      and archived_at is null
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
    from public.group_members
    where group_id = check_group_id
      and user_id = check_user_id
      and role = 'group_admin'
      and archived_at is null
  );
$$;

create or replace function public.is_event_group_member(check_event_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = check_event_id
      and public.is_group_member(e.group_id, check_user_id)
  );
$$;

create or replace function public.is_event_group_admin(check_event_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = check_event_id
      and public.is_group_admin(e.group_id, check_user_id)
  );
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_comments enable row level security;
alter table public.event_history enable row level security;
alter table public.event_reminders enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_site_admin());

drop policy if exists "Users can read profiles shared through groups" on public.profiles;
create policy "Users can read profiles shared through groups"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid()
      and theirs.user_id = profiles.id
      and mine.archived_at is null
      and theirs.archived_at is null
  )
  or public.is_site_admin()
);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Authenticated users can create groups" on public.groups;
create policy "Authenticated users can create groups"
on public.groups for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Members can read their groups" on public.groups;
create policy "Members can read their groups"
on public.groups for select
to authenticated
using (public.is_group_member(id) or public.is_site_admin());

drop policy if exists "Group admins can update groups" on public.groups;
create policy "Group admins can update groups"
on public.groups for update
to authenticated
using (public.is_group_admin(id) or public.is_site_admin())
with check (public.is_group_admin(id) or public.is_site_admin());

drop policy if exists "Members can read group memberships" on public.group_members;
create policy "Members can read group memberships"
on public.group_members for select
to authenticated
using (public.is_group_member(group_id) or public.is_site_admin());

drop policy if exists "Group admins can manage memberships" on public.group_members;
create policy "Group admins can manage memberships"
on public.group_members for all
to authenticated
using (public.is_group_admin(group_id) or public.is_site_admin())
with check (public.is_group_admin(group_id) or public.is_site_admin());

drop policy if exists "Admins can create invites" on public.group_invites;
create policy "Admins can create invites"
on public.group_invites for insert
to authenticated
with check ((public.is_group_admin(group_id) or public.is_site_admin()) and created_by = auth.uid());

drop policy if exists "Admins can read invites" on public.group_invites;
create policy "Admins can read invites"
on public.group_invites for select
to authenticated
using (public.is_group_admin(group_id) or public.is_site_admin());

drop policy if exists "Admins can update invites" on public.group_invites;
create policy "Admins can update invites"
on public.group_invites for update
to authenticated
using (public.is_group_admin(group_id) or public.is_site_admin())
with check (public.is_group_admin(group_id) or public.is_site_admin());

drop policy if exists "Members can read active categories" on public.categories;
create policy "Members can read active categories"
on public.categories for select
to authenticated
using (public.is_group_member(group_id) or public.is_site_admin());

drop policy if exists "Group admins can manage categories" on public.categories;
create policy "Group admins can manage categories"
on public.categories for all
to authenticated
using (public.is_group_admin(group_id) or public.is_site_admin())
with check (public.is_group_admin(group_id) or public.is_site_admin());

drop policy if exists "Members can read locations" on public.locations;
create policy "Members can read locations"
on public.locations for select
to authenticated
using (public.is_group_member(group_id) or public.is_site_admin());

drop policy if exists "Members can create locations" on public.locations;
create policy "Members can create locations"
on public.locations for insert
to authenticated
with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists "Location creators and admins can update locations" on public.locations;
create policy "Location creators and admins can update locations"
on public.locations for update
to authenticated
using (created_by = auth.uid() or public.is_group_admin(group_id) or public.is_site_admin())
with check (created_by = auth.uid() or public.is_group_admin(group_id) or public.is_site_admin());

drop policy if exists "Members can read group events" on public.events;
create policy "Members can read group events"
on public.events for select
to authenticated
using (public.is_group_member(group_id) or public.is_site_admin());

drop policy if exists "Members can create events" on public.events;
create policy "Members can create events"
on public.events for insert
to authenticated
with check (public.is_group_member(group_id) and owner_id = auth.uid());

drop policy if exists "Owners and admins can update events" on public.events;
create policy "Owners and admins can update events"
on public.events for update
to authenticated
using (owner_id = auth.uid() or public.is_group_admin(group_id) or public.is_site_admin())
with check (owner_id = auth.uid() or public.is_group_admin(group_id) or public.is_site_admin());

drop policy if exists "Members can read event RSVPs" on public.event_rsvps;
create policy "Members can read event RSVPs"
on public.event_rsvps for select
to authenticated
using (public.is_event_group_member(event_id) or public.is_site_admin());

drop policy if exists "Users can create their own RSVP" on public.event_rsvps;
create policy "Users can create their own RSVP"
on public.event_rsvps for insert
to authenticated
with check (user_id = auth.uid() and public.is_event_group_member(event_id));

drop policy if exists "Users can update their own RSVP" on public.event_rsvps;
create policy "Users can update their own RSVP"
on public.event_rsvps for update
to authenticated
using (user_id = auth.uid() or public.is_event_group_admin(event_id) or public.is_site_admin())
with check (user_id = auth.uid() or public.is_event_group_admin(event_id) or public.is_site_admin());

drop policy if exists "Members can read comments" on public.event_comments;
create policy "Members can read comments"
on public.event_comments for select
to authenticated
using (public.is_event_group_member(event_id) or public.is_site_admin());

drop policy if exists "Members can create comments" on public.event_comments;
create policy "Members can create comments"
on public.event_comments for insert
to authenticated
with check (user_id = auth.uid() and public.is_event_group_member(event_id));

drop policy if exists "Authors and admins can update comments" on public.event_comments;
create policy "Authors and admins can update comments"
on public.event_comments for update
to authenticated
using (user_id = auth.uid() or public.is_event_group_admin(event_id) or public.is_site_admin())
with check (user_id = auth.uid() or public.is_event_group_admin(event_id) or public.is_site_admin());

drop policy if exists "Members can read event history" on public.event_history;
create policy "Members can read event history"
on public.event_history for select
to authenticated
using (public.is_event_group_member(event_id) or public.is_site_admin());

drop policy if exists "Owners and admins can insert event history" on public.event_history;
create policy "Owners and admins can insert event history"
on public.event_history for insert
to authenticated
with check (public.is_event_group_member(event_id) and (changed_by = auth.uid() or changed_by is null));

drop policy if exists "Users can read their reminders" on public.event_reminders;
create policy "Users can read their reminders"
on public.event_reminders for select
to authenticated
using (user_id = auth.uid() or public.is_site_admin());

drop policy if exists "Users can manage their reminders" on public.event_reminders;
create policy "Users can manage their reminders"
on public.event_reminders for all
to authenticated
using (user_id = auth.uid() or public.is_site_admin())
with check (user_id = auth.uid() or public.is_site_admin());

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

  select *
  into target_invite
  from public.group_invites
  where token = invite_token
    and is_active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  for update;

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

drop view if exists public.public_event_cards;
create view public.public_event_cards
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
  and e.status in ('open', 'confirmed')
group by e.id, g.name, c.name, c.color, c.icon;

grant select on public.public_event_cards to anon, authenticated;
