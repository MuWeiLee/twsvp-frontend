-- add language preference to users/profiles
alter table public.users
add column if not exists language text;

alter table public.profiles
add column if not exists language text;
