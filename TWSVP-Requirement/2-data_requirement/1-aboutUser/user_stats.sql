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