-- public.stock_price_backfill_state: backfill cursor/state
create table if not exists public.stock_price_backfill_state (
  state_id bigint generated always as identity primary key,
  source text not null default 'finmind',
  dataset text not null,
  start_date date not null,
  end_date date not null,
  cursor_date date not null,
  stock_offset integer not null default 0,
  max_stocks integer not null default 200,
  status text not null default 'running',
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_stock_price_backfill_state_updated_at on public.stock_price_backfill_state;
create trigger trg_stock_price_backfill_state_updated_at
before update on public.stock_price_backfill_state
for each row execute function public.set_updated_at();

create index if not exists idx_stock_price_backfill_state_status
on public.stock_price_backfill_state(status);

alter table public.stock_price_backfill_state enable row level security;

drop policy if exists "stock_price_backfill_state_select_authenticated" on public.stock_price_backfill_state;
create policy "stock_price_backfill_state_select_authenticated"
on public.stock_price_backfill_state for select
to authenticated
using (true);
