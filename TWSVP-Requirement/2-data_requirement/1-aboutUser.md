# TWSVP 用户表设计（新手可照做版 / Supabase）
> 目标：让你在 Supabase 里把「用户体系」一次性搭好：  
> - Google OAuth 登录后自动有用户资料（Profile）  
> - 首次登录需要完善昵称/简介/感兴趣行业  
> - 个人中心能展示观点数等统计（先占位，后续再接 Feed）  
>
> 你将会创建的所有表都在 **public schema**（Supabase 的 Table Editor 默认就是 public）。  
> Supabase 自带的 `auth.users` 不用你建，也不建议你改。

---

## 0. 你需要哪些表？（总览）
### 必建（MVP 必须）
1. **public.profiles**：用户资料（昵称、头像、简介、完成资料时间等）
2. **public.industries**：行业基础表（台股一级行业枚举）
3. **public.user_industries**：用户-行业关系表（多选 3~5 个）

### 建议建（现在建了以后省事）
4. **public.user_settings**：用户偏好（默认排序等，先占位）
5. **public.user_stats**：用户统计缓存（观点数/胜率等，先占位）

### 可选（你真的要做“关注”才建）
6. **public.user_follows**：关注关系（被关注数、关注数）

---

## 1. 这些表应该在哪里建立？
### ✅ 推荐方式（新手最稳）：Supabase SQL Editor 直接粘贴执行
路径：Supabase 项目 → **SQL Editor** → New query → 粘贴下面 SQL → Run

为什么推荐 SQL Editor：
- 一次性建完表、索引、约束、RLS 权限策略
- 不会漏字段、漏主键、漏外键

> 你也可以用 Table Editor 手动建表，但新手容易漏主键/外键/RLS，后面会卡住。

---

## 2. 一键可执行 SQL（建表 + 约束 + RLS + 示例数据）
> 你可以直接整段复制到 SQL Editor 运行。  
> 如果你已经建过某些表，也可以分段运行（但建议先全新项目一次跑完）。

### 2.1 建通用函数：自动维护 updated_at
```sql
-- 1) 通用：自动更新时间戳
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
2.2 profiles（用户资料表）
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
profiles 字段说明
字段	类型	必填	说明
user_id	uuid	✅	= auth.users.id（主键）
nickname	text	✅	默认用 Google name，用户可改
bio	text	❌	个人介绍（可换行）
avatar_url	text	❌	默认 Google 头像
first_login_at	timestamptz	✅	首次登录时间（也可用 auth.users.created_at）
profile_completed_at	timestamptz	❌	用户完成 PersonalSetting 时写入
created_at / updated_at	timestamptz	✅	记录创建/更新时间
2.3 industries（行业基础表）
-- 3) 行业基础表：public.industries
create table if not exists public.industries (
  industry_id bigint generated always as identity primary key,
  name text not null unique,
  order_no int not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_industries_updated_at on public.industries;
create trigger trg_industries_updated_at
before update on public.industries
for each row execute function public.set_updated_at();
industries 字段说明
字段	类型	必填	说明
industry_id	bigint	✅	自增主键
name	text	✅	行业名称（唯一）
order_no	int	✅	排序用
is_active	boolean	✅	是否可用
created_at / updated_at	timestamptz	✅	记录创建/更新时间
2.4 user_industries（用户-行业关系表，多选）
-- 4) 用户-行业关系表：public.user_industries
create table if not exists public.user_industries (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  industry_id bigint not null references public.industries(industry_id),

  created_at timestamptz not null default now(),

  primary key (user_id, industry_id)
);

create index if not exists idx_user_industries_user_id on public.user_industries(user_id);
create index if not exists idx_user_industries_industry_id on public.user_industries(industry_id);
user_industries 字段说明
字段	类型	必填	说明
user_id	uuid	✅	对应 profiles.user_id
industry_id	bigint	✅	对应 industries.industry_id
created_at	timestamptz	✅	选择时间
PK(user_id, industry_id)		✅	防止重复选择同一行业
你想限制“最多选 3~5 个”，建议先在前端限制（MVP 最省事）。
需要硬限制也能做 trigger，后面我可以补。

2.5 user_settings（用户偏好设置，先占位）
-- 5) 用户偏好设置：public.user_settings
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,

  feed_sort_preference text not null default 'time',
  feed_filter_preference text not null default 'all',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_feed_sort_preference check (feed_sort_preference in ('time','hot')),
  constraint chk_feed_filter_preference check (feed_filter_preference in ('all','active_first'))
);

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();
2.6 user_stats（用户统计缓存，先占位）
-- 6) 用户统计缓存：public.user_stats
create table if not exists public.user_stats (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,

  feeds_total int not null default 0,
  feeds_active int not null default 0,
  feeds_closed int not null default 0,

  win_rate numeric(5,2),
  avg_return numeric(10,4),
  total_return numeric(12,4),

  updated_at timestamptz not null default now()
);
MVP 你可以先不写 win_rate/return 的值，页面展示“待结算”。

2.7 （可选）user_follows（关注关系）
-- 7) 可选：关注关系 public.user_follows
create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(user_id) on delete cascade,
  followee_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (follower_id, followee_id),
  constraint chk_no_self_follow check (follower_id <> followee_id)
);

create index if not exists idx_user_follows_followee on public.user_follows(followee_id);
create index if not exists idx_user_follows_follower on public.user_follows(follower_id);
3. RLS 权限策略（非常重要）
Supabase 默认建议开启 RLS。否则你很容易出现“任何人都能改别人资料”的安全问题。

3.1 开启 RLS
alter table public.profiles enable row level security;
alter table public.user_industries enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_stats enable row level security;
alter table public.industries enable row level security;

-- 可选表
alter table public.user_follows enable row level security;
3.2 profiles：所有登录用户可读（用于 PersonalViewer），仅本人可改
-- 读：任何已登录用户可读（他人主页需要）
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

-- 写：仅本人可 insert
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

-- 改：仅本人可 update
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
3.3 industries：所有登录用户可读；写入先不开放（你手动维护）
drop policy if exists "industries_select_authenticated" on public.industries;
create policy "industries_select_authenticated"
on public.industries for select
to authenticated
using (true);
维护 industries：你可以用 SQL Editor 手动 insert（管理员动作），不通过 App。

3.4 user_industries：所有登录用户可读（可用于他人画像展示），仅本人可改
drop policy if exists "user_industries_select_authenticated" on public.user_industries;
create policy "user_industries_select_authenticated"
on public.user_industries for select
to authenticated
using (true);

drop policy if exists "user_industries_insert_own" on public.user_industries;
create policy "user_industries_insert_own"
on public.user_industries for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_industries_delete_own" on public.user_industries;
create policy "user_industries_delete_own"
on public.user_industries for delete
to authenticated
using (auth.uid() = user_id);
3.5 user_settings：仅本人可读写
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_settings_upsert_own" on public.user_settings;
create policy "user_settings_upsert_own"
on public.user_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
3.6 user_stats：所有登录用户可读（用于看他人统计），写入暂由你后续后台/触发器维护
drop policy if exists "user_stats_select_authenticated" on public.user_stats;
create policy "user_stats_select_authenticated"
on public.user_stats for select
to authenticated
using (true);
stats 的写入你后面接 Feed 后再做（trigger 或定时任务），MVP 可以先不写策略或只让 service role 写。

4. 示例数据（让你在 Table Editor 里能看到效果）
4.1 插入 industries 示例（你要替换成台股一级行业）
insert into public.industries (name, order_no) values
('半导体', 10),
('金融保险', 20),
('航运', 30),
('电子零组件', 40)
on conflict (name) do nothing;
4.2 profiles / user_industries 示例（⚠️ 需要真实 user_id 才能插入）
profiles 必须用你 auth.users 里真实的 UUID。
你可以在 Supabase → Authentication → Users 里找到用户 id。

示例（把 00000000-... 换成你的真实 UUID）：

-- 例：创建 profile（通常你会在登录后 upsert，这里只是示例）
insert into public.profiles (user_id, nickname, bio, avatar_url)
values (
  '00000000-0000-0000-0000-000000000000',
  'AB1测试用户',
  '这是我的个人介绍\n可以换行',
  'https://example.com/avatar.png'
)
on conflict (user_id) do update
set nickname = excluded.nickname,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url;

-- 例：选择感兴趣行业（多选）
insert into public.user_industries (user_id, industry_id)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  industry_id
from public.industries
where name in ('半导体', '金融保险')
on conflict do nothing;

-- 例：初始化 settings（可选）
insert into public.user_settings (user_id, feed_sort_preference, feed_filter_preference)
values ('00000000-0000-0000-0000-000000000000', 'time', 'all')
on conflict (user_id) do update
set feed_sort_preference = excluded.feed_sort_preference,
    feed_filter_preference = excluded.feed_filter_preference;

-- 例：初始化 stats（可选）
insert into public.user_stats (user_id)
values ('00000000-0000-0000-0000-000000000000')
on conflict (user_id) do nothing;
5. 你在产品里应该怎么用（关键流程）
5.1 登录（Google OAuth）成功后：立刻做 profile upsert
目的：确保每个登录用户都有 profiles 行

用 auth.uid() 作为 user_id

nickname 默认用 Google name

avatar_url 默认用 Google 头像

这样 Login → FeedFlow 就不会因为缺 profile 报错。

5.2 首次登录进入 PersonalSetting：保存资料 + 行业
保存时做两件事：

profiles 更新：nickname/bio/avatar_url + 写入 profile_completed_at = now()

user_industries 写入：先删旧的，再插入新的（保持一致）

5.3 Profile 完整度判断（Login 分流）
你可以用规则：

profiles.nickname 非空

user_industries 至少 1 条

profile_completed_at 非空（可选，但很方便）

6. 新手检查清单（你做完就能验证成功）
Supabase → Table Editor 里看到这些表：

profiles / industries / user_industries / user_settings / user_stats

Authentication → Users 里有你的 Google 登录用户

profiles 里能看到对应 user_id 的一行资料

industries 有数据

user_industries 里能看到该用户选择的行业

你用一个非本人账号登录后，应该：

能 select 读取他人的 profiles（PersonalViewer 需要）

不能 update 他人的 profiles（RLS 会拦）

7. 常见问题（新手必踩）
Q1：为什么 profiles 的主键用 user_id（uuid）？
因为 Supabase 的用户真实身份在 auth.users.id，用它当业务主键最干净、不会重复。

Q2：行业为什么不用 profiles 里一个数组字段？
数组会让查询/统计/索引变复杂；关系表 user_industries 才是最稳定的做法。

Q3：为什么 profiles 允许所有 authenticated 用户 select？
因为你有 PersonalViewer（他人主页），必须能看别人资料；但 update 被严格限制为本人。