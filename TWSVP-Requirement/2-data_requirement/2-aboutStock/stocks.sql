-- public.stocks: 股票清单（上市/上柜/兴柜）
create table if not exists public.stocks (
  stock_id text primary key,
  name text not null,
  market text not null,
  industry text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_stock_market check (market in ('上市', '上櫃', '興櫃'))
);

drop trigger if exists trg_stocks_updated_at on public.stocks;
create trigger trg_stocks_updated_at
before update on public.stocks
for each row execute function public.set_updated_at();

create index if not exists idx_stocks_market on public.stocks(market);

alter table public.stocks enable row level security;

drop policy if exists "stocks_select_authenticated" on public.stocks;
create policy "stocks_select_authenticated"
on public.stocks for select
to authenticated
using (true);
