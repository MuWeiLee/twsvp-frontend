create table if not exists public.ptt_hot_sync_state (
  state_key text primary key,
  stock_offset integer not null default 0,
  total_stocks integer not null default 0,
  status text not null default 'idle',
  last_run_started_at timestamptz,
  last_run_finished_at timestamptz,
  last_batch_size integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.ptt_hot_sync_state (state_key)
values ('default')
on conflict (state_key) do nothing;

create table if not exists public.ptt_hot_sync_logs (
  log_id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  stock_id text not null references public.stocks(stock_id) on delete cascade,
  stock_name text not null,
  stock_offset integer,
  since_hours integer not null default 24,
  min_net_push integer not null default 20,
  queried integer not null default 0,
  saved integer not null default 0,
  with_content integer not null default 0,
  without_content integer not null default 0,
  page_fetches integer not null default 0,
  page_successes integer not null default 0,
  page_failures integer not null default 0,
  status text not null,
  error_message text,
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ptt_hot_sync_logs_run_id_idx
  on public.ptt_hot_sync_logs (run_id);

create index if not exists ptt_hot_sync_logs_stock_id_idx
  on public.ptt_hot_sync_logs (stock_id);

create index if not exists ptt_hot_sync_logs_created_at_idx
  on public.ptt_hot_sync_logs (created_at desc);
