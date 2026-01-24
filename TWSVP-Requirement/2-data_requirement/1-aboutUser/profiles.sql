-- 2) 用户资料表：public.profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  nickname text not null,
  bio text,
  avatar_url text,

  first_login_at timestamptz not null default now(),
  profile_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 自动维护 updated_at
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
