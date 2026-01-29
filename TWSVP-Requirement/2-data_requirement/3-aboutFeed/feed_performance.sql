-- public.feed_performance: 观点绩效
create table if not exists public.feed_performance (
  feed_id bigint primary key references public.feeds(feed_id) on delete cascade,
  base_date date not null,
  end_date date not null,
  base_open numeric(12, 4),
  end_close numeric(12, 4),
  performance_pct numeric(10, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_feed_performance_updated_at on public.feed_performance;
create trigger trg_feed_performance_updated_at
before update on public.feed_performance
for each row execute function public.set_updated_at();

create index if not exists idx_feed_performance_end_date on public.feed_performance(end_date desc);

alter table public.feed_performance enable row level security;

drop policy if exists "feed_performance_select_authenticated" on public.feed_performance;
create policy "feed_performance_select_authenticated"
on public.feed_performance for select
to authenticated
using (true);
