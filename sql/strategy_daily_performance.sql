create table if not exists public.strategy_daily_performance (
  strategy_id text not null,
  trade_date date not null,
  daily_return numeric(12, 6),
  weighted_return numeric(12, 6),
  holdings_count integer,
  weight_sum numeric(12, 6),
  source text not null default 'cron',
  created_at timestamptz not null default now(),
  primary key (strategy_id, trade_date)
);

create index if not exists strategy_daily_performance_trade_date_idx
  on public.strategy_daily_performance (trade_date);

create index if not exists strategy_daily_performance_strategy_id_idx
  on public.strategy_daily_performance (strategy_id);

alter table public.strategy_daily_performance enable row level security;

create policy "strategy_daily_performance_read"
  on public.strategy_daily_performance
  for select
  to authenticated
  using (true);
