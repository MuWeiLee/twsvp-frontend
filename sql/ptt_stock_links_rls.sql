alter table if exists public.ptt_stock_links enable row level security;
alter table if exists public.ptt_stock_links force row level security;

grant select on table public.ptt_stock_links to anon, authenticated;
revoke insert, update, delete on table public.ptt_stock_links from anon, authenticated;

drop policy if exists ptt_stock_links_select_anon on public.ptt_stock_links;
create policy ptt_stock_links_select_anon
  on public.ptt_stock_links
  for select
  to anon
  using (true);

drop policy if exists ptt_stock_links_select_authenticated on public.ptt_stock_links;
create policy ptt_stock_links_select_authenticated
  on public.ptt_stock_links
  for select
  to authenticated
  using (true);

drop policy if exists ptt_stock_links_no_client_insert on public.ptt_stock_links;
create policy ptt_stock_links_no_client_insert
  on public.ptt_stock_links
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists ptt_stock_links_no_client_update on public.ptt_stock_links;
create policy ptt_stock_links_no_client_update
  on public.ptt_stock_links
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists ptt_stock_links_no_client_delete on public.ptt_stock_links;
create policy ptt_stock_links_no_client_delete
  on public.ptt_stock_links
  for delete
  to anon, authenticated
  using (false);
