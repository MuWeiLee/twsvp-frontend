create table if not exists public.strategy_meta (
  strategy_id text primary key,
  display_name text,
  updated_at timestamptz not null default now()
);

alter table public.strategy_meta enable row level security;

create policy "strategy_meta_read"
  on public.strategy_meta
  for select
  to authenticated
  using (true);

create policy "strategy_meta_admin_write"
  on public.strategy_meta
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'pai.product.manager@gmail.com');

create policy "strategy_meta_admin_update"
  on public.strategy_meta
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'pai.product.manager@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'pai.product.manager@gmail.com');
