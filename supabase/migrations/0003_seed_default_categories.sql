-- Seed default categories for each newly-created group.

create or replace function public.seed_default_categories(target_group_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (group_id, name, color, icon, sort_order)
  values
    (target_group_id, 'DnD', '#b45309', 'dice-d20', 10),
    (target_group_id, 'Gaming', '#2563eb', 'gamepad-2', 20),
    (target_group_id, 'Warhammer', '#991b1b', 'sword', 30),
    (target_group_id, 'Mini Painting', '#7c3aed', 'brush', 40),
    (target_group_id, 'Board Games', '#15803d', 'layout-grid', 50),
    (target_group_id, 'Other', '#6b7280', 'sparkles', 60)
  on conflict (group_id, name) do nothing;
$$;

create or replace function public.handle_new_group_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'group_admin')
  on conflict (group_id, user_id) do update set
    role = 'group_admin',
    archived_at = null;

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;

drop trigger if exists on_group_created_seed_defaults on public.groups;
create trigger on_group_created_seed_defaults
after insert on public.groups
for each row execute function public.handle_new_group_defaults();
