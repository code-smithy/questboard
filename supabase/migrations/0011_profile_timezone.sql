alter table public.profiles
add column if not exists timezone text
check (timezone is null or char_length(timezone) between 1 and 128);
