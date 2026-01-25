-- public.feeds: 观点表
create table if not exists public.feeds (
  feed_id bigint generated always as identity primary key,
  user_id uuid not null references public.users(user_id) on delete cascade,
  target_type text not null default 'stock',
  target_symbol text,
  target_name text not null,
  direction text not null,
  horizon text not null,
  summary text,
  content text not null,
  status text not null default 'active',
  visibility text not null default 'public',
  expires_at timestamptz,
  like_count int not null default 0,
  bookmark_count int not null default 0,
  share_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chk_feed_target_type check (target_type in ('stock', 'sector')),
  constraint chk_feed_direction check (direction in ('long', 'short', 'neutral')),
  constraint chk_feed_horizon check (horizon in ('ultra_short', 'short', 'medium', 'long')),
  constraint chk_feed_status check (status in ('active', 'expired', 'verified', 'deleted')),
  constraint chk_feed_visibility check (visibility in ('public', 'private')),
  constraint chk_feed_target_symbol check (
    (target_type = 'stock' and target_symbol is not null)
    or (target_type = 'sector' and target_symbol is null)
  )
);

drop trigger if exists trg_feeds_updated_at on public.feeds;
create trigger trg_feeds_updated_at
before update on public.feeds
for each row execute function public.set_updated_at();

create index if not exists idx_feeds_user_id on public.feeds(user_id);
create index if not exists idx_feeds_status on public.feeds(status);
create index if not exists idx_feeds_created_at on public.feeds(created_at desc);
create index if not exists idx_feeds_target on public.feeds(target_type, target_symbol, target_name);

-- 点赞计数函数（避免 RLS 影响）
create or replace function public.bump_feed_like(p_feed_id bigint, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.feeds
  set like_count = greatest(like_count + p_delta, 0)
  where feed_id = p_feed_id;
end;
$$;

grant execute on function public.bump_feed_like(bigint, int) to authenticated;

alter table public.feeds enable row level security;

drop policy if exists "feeds_select_authenticated" on public.feeds;
create policy "feeds_select_authenticated"
on public.feeds for select
to authenticated
using (visibility = 'public' or auth.uid() = user_id);

drop policy if exists "feeds_insert_own" on public.feeds;
create policy "feeds_insert_own"
on public.feeds for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "feeds_update_own" on public.feeds;
create policy "feeds_update_own"
on public.feeds for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "feeds_delete_own" on public.feeds;
create policy "feeds_delete_own"
on public.feeds for delete
to authenticated
using (auth.uid() = user_id);
