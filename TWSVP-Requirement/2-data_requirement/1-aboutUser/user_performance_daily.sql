-- public.user_performance_daily: 用户绩效日快照
create table if not exists public.user_performance_daily (
  performance_id bigint generated always as identity primary key,
  user_id uuid not null references public.users(user_id) on delete cascade,
  as_of_date date not null,

  feeds_total int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  win_rate numeric(5,2),
  avg_return numeric(10,4),
  total_return numeric(12,4),

  updated_at timestamptz not null default now(),
  unique (user_id, as_of_date)
);

drop trigger if exists trg_user_performance_daily_updated_at on public.user_performance_daily;
create trigger trg_user_performance_daily_updated_at
before update on public.user_performance_daily
for each row execute function public.set_updated_at();

create index if not exists idx_user_performance_daily_user_id on public.user_performance_daily(user_id);
create index if not exists idx_user_performance_daily_as_of_date on public.user_performance_daily(as_of_date desc);

alter table public.user_performance_daily enable row level security;

drop policy if exists "user_performance_daily_select_authenticated" on public.user_performance_daily;
create policy "user_performance_daily_select_authenticated"
on public.user_performance_daily for select
to authenticated
using (true);
