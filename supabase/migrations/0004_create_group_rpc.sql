-- Create groups, creator membership, and default categories in one RLS-safe call.

create or replace function public.create_group_with_defaults(
  group_name text,
  group_description text default null,
  group_theme text default null,
  group_created_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a guild.';
  end if;

  if group_created_by is distinct from auth.uid() then
    raise exception 'Guild creator must match the signed-in user.';
  end if;

  if nullif(btrim(group_name), '') is null then
    raise exception 'Give the guild a name before creating it.';
  end if;

  insert into public.groups (name, description, theme, created_by)
  values (
    btrim(group_name),
    nullif(btrim(group_description), ''),
    nullif(btrim(group_theme), ''),
    auth.uid()
  )
  returning id into created_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (created_group_id, auth.uid(), 'group_admin')
  on conflict (group_id, user_id) do update set
    role = 'group_admin',
    archived_at = null;

  perform public.seed_default_categories(created_group_id);

  return created_group_id;
end;
$$;

grant execute on function public.create_group_with_defaults(text, text, text, uuid) to authenticated;
