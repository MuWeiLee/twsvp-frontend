-- Stock price pipeline hardening
-- Safe to run multiple times.

alter table if exists public.stock_price_missing
  add column if not exists status text not null default 'pending',
  add column if not exists source text not null default 'finmind',
  add column if not exists dataset text not null default 'TaiwanStockPrice',
  add column if not exists reason text,
  add column if not exists detail jsonb not null default '{}'::jsonb,
  add column if not exists last_error text;

update public.stock_price_missing
set status = 'pending'
where status is null;

create unique index if not exists stock_price_missing_unique
  on public.stock_price_missing (stock_id, trade_date);

create index if not exists stock_price_missing_status_trade_date_idx
  on public.stock_price_missing (status, trade_date desc);

create index if not exists stock_price_missing_trade_date_idx
  on public.stock_price_missing (trade_date desc);

alter table if exists public.stock_price_missing_ranges
  add column if not exists status text not null default 'pending',
  add column if not exists total_rows integer not null default 0,
  add column if not exists last_error text,
  add column if not exists source text not null default 'finmind',
  add column if not exists dataset text not null default 'TaiwanStockPrice',
  add column if not exists reason text,
  add column if not exists detail jsonb not null default '{}'::jsonb;

update public.stock_price_missing_ranges
set status = 'pending'
where status is null;

create unique index if not exists stock_price_missing_ranges_unique
  on public.stock_price_missing_ranges (stock_id, start_date, end_date);

create index if not exists stock_price_missing_ranges_status_start_date_idx
  on public.stock_price_missing_ranges (status, start_date desc);

create index if not exists stock_price_backfill_state_status_updated_idx
  on public.stock_price_backfill_state (source, dataset, status, updated_at desc);

create index if not exists stock_price_sync_logs_status_started_idx
  on public.stock_price_sync_logs (status, started_at desc);
