create table if not exists public.trading_calendar (
  trade_date date primary key,
  created_at timestamptz not null default now()
);
