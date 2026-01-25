-- public.stock_price_sync_logs: stock price sync runs
create table if not exists public.stock_price_sync_logs (
  log_id bigint generated always as identity primary key,
  source text not null,
  start_date date,
  end_date date,
  status text not null default 'running',
  total_rows integer not null default 0,
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_stock_price_sync_logs_updated_at on public.stock_price_sync_logs;
create trigger trg_stock_price_sync_logs_updated_at
before update on public.stock_price_sync_logs
for each row execute function public.set_updated_at();

create index if not exists idx_stock_price_sync_logs_started_at
on public.stock_price_sync_logs(started_at desc);

create index if not exists idx_stock_price_sync_logs_status
on public.stock_price_sync_logs(status);

alter table public.stock_price_sync_logs enable row level security;

drop policy if exists "stock_price_sync_logs_select_authenticated" on public.stock_price_sync_logs;
create policy "stock_price_sync_logs_select_authenticated"
on public.stock_price_sync_logs for select
to authenticated
using (true);
