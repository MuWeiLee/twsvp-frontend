-- public.users: 业务用户表（与 auth.users 分离）
create table if not exists public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text not null,
  bio text,
  avatar_url text,
  first_login_at timestamptz not null default now(),
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- 可选：从 profiles 同步已有数据（仅执行一次即可）
insert into public.users (user_id, nickname, bio, avatar_url, first_login_at, profile_completed_at, created_at, updated_at)
select
  user_id,
  nickname,
  bio,
  avatar_url,
  first_login_at,
  profile_completed_at,
  created_at,
  updated_at
from public.profiles
on conflict (user_id) do update
set nickname = excluded.nickname,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url,
    profile_completed_at = excluded.profile_completed_at,
    updated_at = excluded.updated_at;

-- RLS
alter table public.users enable row level security;

drop policy if exists "users_select_authenticated" on public.users;
create policy "users_select_authenticated"
on public.users for select
to authenticated
using (true);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
