-- public.stock_prices: 个股日线价格
create table if not exists public.stock_prices (
  price_id bigint generated always as identity primary key,
  stock_id text not null references public.stocks(stock_id) on delete cascade,
  trade_date date not null,
  open numeric(12, 4),
  high numeric(12, 4),
  low numeric(12, 4),
  close numeric(12, 4),
  average numeric(12, 4),
  volume bigint,
  turnover numeric(18, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stock_id, trade_date)
);

drop trigger if exists trg_stock_prices_updated_at on public.stock_prices;
create trigger trg_stock_prices_updated_at
before update on public.stock_prices
for each row execute function public.set_updated_at();

create index if not exists idx_stock_prices_stock_id on public.stock_prices(stock_id);
create index if not exists idx_stock_prices_trade_date on public.stock_prices(trade_date desc);

alter table public.stock_prices enable row level security;

drop policy if exists "stock_prices_select_authenticated" on public.stock_prices;
create policy "stock_prices_select_authenticated"
on public.stock_prices for select
to authenticated
using (true);
