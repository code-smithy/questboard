-- Guild member roster management through RLS-safe RPCs.

create or replace function public.leave_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_membership public.group_members%rowtype;
  active_admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to leave a guild.';
  end if;

  select gm.*
  into current_membership
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.group_id = target_group_id
    and gm.user_id = auth.uid()
    and gm.archived_at is null
    and g.archived_at is null
  for update of gm;

  if not found then
    raise exception 'You are not an active member of this guild.';
  end if;

  if current_membership.role = 'group_admin' then
    select count(*)::integer
    into active_admin_count
    from public.group_members
    where group_id = target_group_id
      and role = 'group_admin'
      and archived_at is null;

    if active_admin_count <= 1 then
      raise exception 'A guild needs at least one active admin.';
    end if;
  end if;

  update public.group_members
  set archived_at = now()
  where id = current_membership.id;
end;
$$;

grant execute on function public.leave_group(uuid) to authenticated;

create or replace function public.remove_group_member(target_group_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.group_members%rowtype;
  active_admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to remove a guild member.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Use leave guild to remove your own membership.';
  end if;

  if not (public.is_group_admin(target_group_id, auth.uid()) or public.is_site_admin()) then
    raise exception 'Only guild admins can remove guild members.';
  end if;

  select gm.*
  into target_membership
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id
    and gm.archived_at is null
    and g.archived_at is null
  for update of gm;

  if not found then
    raise exception 'Guild member was not found or is already removed.';
  end if;

  if target_membership.role = 'group_admin' then
    select count(*)::integer
    into active_admin_count
    from public.group_members
    where group_id = target_group_id
      and role = 'group_admin'
      and archived_at is null;

    if active_admin_count <= 1 then
      raise exception 'A guild needs at least one active admin.';
    end if;
  end if;

  update public.group_members
  set archived_at = now()
  where id = target_membership.id;
end;
$$;

grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
