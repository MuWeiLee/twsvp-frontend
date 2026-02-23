alter table if exists public.ptt_sync_runs enable row level security;
alter table if exists public.ptt_sync_runs force row level security;

revoke all on table public.ptt_sync_runs from anon, authenticated;

drop policy if exists ptt_sync_runs_deny_anon on public.ptt_sync_runs;
create policy ptt_sync_runs_deny_anon
  on public.ptt_sync_runs
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists ptt_sync_runs_deny_authenticated on public.ptt_sync_runs;
create policy ptt_sync_runs_deny_authenticated
  on public.ptt_sync_runs
  for all
  to authenticated
  using (false)
  with check (false);
