profiles 字段说明
字段	类型	必填	说明
user_id	uuid	✅	= auth.users.id（主键）
nickname	text	✅	默认用 Google name，用户可改
bio	text	❌	个人介绍（可换行）
avatar_url	text	❌	默认 Google 头像
first_login_at	timestamptz	✅	首次登录时间（也可用 auth.users.created_at）
profile_completed_at	timestamptz	❌	用户完成 PersonalSetting 时写入
created_at / updated_at	timestamptz	✅	记录创建/更新时间


SQL:
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
