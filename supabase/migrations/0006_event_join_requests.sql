-- Public event join requests for authenticated users outside a guild.

create table if not exists public.event_join_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, requester_id)
);

create index if not exists event_join_requests_event_status_idx on public.event_join_requests (event_id, status);
create index if not exists event_join_requests_requester_idx on public.event_join_requests (requester_id, status);

drop trigger if exists set_event_join_requests_updated_at on public.event_join_requests;
create trigger set_event_join_requests_updated_at
before update on public.event_join_requests
for each row execute function public.set_updated_at();

create or replace function public.is_event_owner_or_group_admin(check_event_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.groups g on g.id = e.group_id
    where e.id = check_event_id
      and e.archived_at is null
      and g.archived_at is null
      and (
        e.owner_id = check_user_id
        or public.is_group_admin(e.group_id, check_user_id)
        or public.is_site_admin(check_user_id)
      )
  );
$$;

alter table public.event_join_requests enable row level security;

drop policy if exists "Requesters and event admins can read event join requests" on public.event_join_requests;
create policy "Requesters and event admins can read event join requests"
on public.event_join_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or public.is_event_owner_or_group_admin(event_id)
);

drop policy if exists "Authenticated users can create their event join requests" on public.event_join_requests;
create policy "Authenticated users can create their event join requests"
on public.event_join_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and exists (
    select 1
    from public.events e
    join public.groups g on g.id = e.group_id
    where e.id = event_join_requests.event_id
      and e.visibility = 'public'
      and e.status in ('open', 'confirmed')
      and e.archived_at is null
      and g.archived_at is null
      and not public.is_group_member(e.group_id, auth.uid())
  )
);

drop policy if exists "Event admins can review event join requests" on public.event_join_requests;
create policy "Event admins can review event join requests"
on public.event_join_requests for update
to authenticated
using (public.is_event_owner_or_group_admin(event_id))
with check (public.is_event_owner_or_group_admin(event_id));

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
  or exists (
    select 1
    from public.event_join_requests ejr
    where ejr.requester_id = profiles.id
      and public.is_event_owner_or_group_admin(ejr.event_id)
  )
  or public.is_site_admin()
);

create or replace function public.request_public_event_join(target_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to request access to this quest.';
  end if;

  select e.*
  into target_event
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = target_event_id
    and e.visibility = 'public'
    and e.status in ('open', 'confirmed')
    and e.archived_at is null
    and g.archived_at is null;

  if not found then
    raise exception 'This public quest is not available for join requests.';
  end if;

  if public.is_group_member(target_event.group_id, auth.uid()) then
    raise exception 'You already belong to this guild.';
  end if;

  insert into public.event_join_requests (event_id, requester_id, status, reviewed_by, reviewed_at)
  values (target_event_id, auth.uid(), 'pending', null, null)
  on conflict (event_id, requester_id) do update set
    status = case
      when event_join_requests.status = 'approved' then event_join_requests.status
      else 'pending'
    end,
    reviewed_by = case
      when event_join_requests.status = 'approved' then event_join_requests.reviewed_by
      else null
    end,
    reviewed_at = case
      when event_join_requests.status = 'approved' then event_join_requests.reviewed_at
      else null
    end
  returning id into request_id;

  insert into public.event_history (event_id, changed_by, change_type, new_value)
  values (target_event_id, auth.uid(), 'join_requested', jsonb_build_object('request_id', request_id));

  return request_id;
end;
$$;

grant execute on function public.request_public_event_join(uuid) to authenticated;

create or replace function public.review_event_join_request(request_id uuid, next_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.event_join_requests%rowtype;
  target_event public.events%rowtype;
  attending_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to review join requests.';
  end if;

  if next_status not in ('approved', 'rejected') then
    raise exception 'Join requests can only be approved or rejected.';
  end if;

  select *
  into target_request
  from public.event_join_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'Join request was not found.';
  end if;

  if not public.is_event_owner_or_group_admin(target_request.event_id, auth.uid()) then
    raise exception 'Only event owners and guild admins can review this join request.';
  end if;

  select *
  into target_event
  from public.events
  where id = target_request.event_id
  for update;

  if not found or target_event.archived_at is not null then
    raise exception 'Quest was not found or has been archived.';
  end if;

  if next_status = 'approved' then
    select count(*)::integer
    into attending_count
    from public.event_rsvps
    where event_id = target_event.id
      and status = 'attending'
      and user_id <> target_request.requester_id;

    if target_event.maximum_attendees is not null and attending_count >= target_event.maximum_attendees then
      raise exception 'This quest is already full.';
    end if;

    insert into public.group_members (group_id, user_id, role)
    values (target_event.group_id, target_request.requester_id, 'regular')
    on conflict (group_id, user_id) do update set
      archived_at = null;

    insert into public.event_rsvps (event_id, user_id, status)
    values (target_event.id, target_request.requester_id, 'attending')
    on conflict (event_id, user_id) do update set
      status = 'attending';
  end if;

  update public.event_join_requests
  set status = next_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = target_request.id;

  insert into public.event_history (event_id, changed_by, change_type, new_value)
  values (
    target_event.id,
    auth.uid(),
    case when next_status = 'approved' then 'join_request_approved' else 'join_request_rejected' end,
    jsonb_build_object('request_id', target_request.id, 'requester_id', target_request.requester_id)
  );

  return target_event.id;
end;
$$;

grant execute on function public.review_event_join_request(uuid, text) to authenticated;

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
  count(r.id) filter (where r.status = 'attending')::integer as attending_count,
  coalesce(public.is_group_member(e.group_id, auth.uid()), false) as viewer_is_group_member,
  (
    select ejr.status
    from public.event_join_requests ejr
    where ejr.event_id = e.id
      and ejr.requester_id = auth.uid()
    limit 1
  ) as current_user_request_status
from public.events e
join public.groups g on g.id = e.group_id
left join public.categories c on c.id = e.category_id
left join public.event_rsvps r on r.event_id = e.id
where e.visibility = 'public'
  and e.archived_at is null
  and g.archived_at is null
  and e.status in ('open', 'confirmed')
group by e.id, e.group_id, g.name, c.name, c.color, c.icon;

grant select on public.public_event_cards to anon, authenticated;
