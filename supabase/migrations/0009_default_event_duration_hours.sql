alter table public.profiles
add column if not exists default_event_duration_hours numeric not null default 4
check (default_event_duration_hours > 0 and default_event_duration_hours <= 168);
