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