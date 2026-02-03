create table if not exists public.strategy_visibility (
  strategy_id text primary key,
  is_visible boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists strategy_visibility_is_visible_idx
  on public.strategy_visibility (is_visible);

alter table public.strategy_visibility enable row level security;

create policy "strategy_visibility_read"
  on public.strategy_visibility
  for select
  to authenticated
  using (true);

create policy "strategy_visibility_admin_write"
  on public.strategy_visibility
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'pai.product.manager@gmail.com');

create policy "strategy_visibility_admin_update"
  on public.strategy_visibility
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'pai.product.manager@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'pai.product.manager@gmail.com');

insert into public.strategy_visibility (strategy_id, is_visible)
values
  ('fixed_5w_aggressive', false),
  ('fixed_5w_low_vol', false),
  ('fixed_5w_income', false),
  ('fixed_5w_steady', false),
  ('fixed_20w_aggressive', false),
  ('fixed_20w_low_vol', false),
  ('fixed_20w_income', false),
  ('fixed_20w_steady', false),
  ('fixed_50w_aggressive', false),
  ('fixed_50w_low_vol', false),
  ('fixed_50w_income', false),
  ('fixed_50w_steady', false),
  ('tw_strength_core_v1', false),
  ('tw_acceleration_monitor_v1', true)
on conflict (strategy_id) do nothing;
