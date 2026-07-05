-- Promote and demote guild stewards through an RLS-safe RPC.

create or replace function public.set_group_member_role(
  target_group_id uuid,
  target_user_id uuid,
  next_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.group_members%rowtype;
  active_steward_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to change guild roles.';
  end if;

  if next_role not in ('group_admin', 'regular') then
    raise exception 'Choose a valid guild role.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Ask another guild steward to change your guild role.';
  end if;

  if not (public.is_group_admin(target_group_id, auth.uid()) or public.is_site_admin()) then
    raise exception 'Only guild stewards can change guild roles.';
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

  if target_membership.role = next_role then
    return;
  end if;

  if target_membership.role = 'group_admin' and next_role = 'regular' then
    select count(*)::integer
    into active_steward_count
    from public.group_members
    where group_id = target_group_id
      and role = 'group_admin'
      and archived_at is null;

    if active_steward_count <= 1 then
      raise exception 'A guild needs at least one active steward.';
    end if;
  end if;

  update public.group_members
  set role = next_role
  where id = target_membership.id;
end;
$$;

grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;
