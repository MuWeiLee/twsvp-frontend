-- Enable RLS for public.ptt_articles and expose read-only access to anon/authenticated.
-- Service role (used by backend sync APIs) bypasses RLS automatically.

alter table if exists public.ptt_articles enable row level security;

-- Optional hardening: force RLS for table owner as well (service_role still bypasses).
alter table if exists public.ptt_articles force row level security;

grant select on table public.ptt_articles to anon, authenticated;
revoke insert, update, delete on table public.ptt_articles from anon, authenticated;

drop policy if exists ptt_articles_select_anon on public.ptt_articles;
create policy ptt_articles_select_anon
  on public.ptt_articles
  for select
  to anon
  using (true);

drop policy if exists ptt_articles_select_authenticated on public.ptt_articles;
create policy ptt_articles_select_authenticated
  on public.ptt_articles
  for select
  to authenticated
  using (true);

-- Explicitly block direct client-side writes; keep writes in backend API only.
drop policy if exists ptt_articles_no_client_insert on public.ptt_articles;
create policy ptt_articles_no_client_insert
  on public.ptt_articles
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists ptt_articles_no_client_update on public.ptt_articles;
create policy ptt_articles_no_client_update
  on public.ptt_articles
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists ptt_articles_no_client_delete on public.ptt_articles;
create policy ptt_articles_no_client_delete
  on public.ptt_articles
  for delete
  to anon, authenticated
  using (false);
