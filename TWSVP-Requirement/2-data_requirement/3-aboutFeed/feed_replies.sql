-- public.feed_replies: 观点留言表
create table if not exists public.feed_replies (
  reply_id bigint generated always as identity primary key,
  feed_id bigint not null references public.feeds(feed_id) on delete cascade,
  user_id uuid not null references public.users(user_id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_replies_feed_id on public.feed_replies(feed_id);
create index if not exists idx_feed_replies_user_id on public.feed_replies(user_id);
create index if not exists idx_feed_replies_created_at on public.feed_replies(created_at);

alter table public.feed_replies enable row level security;

drop policy if exists "feed_replies_select_authenticated" on public.feed_replies;
create policy "feed_replies_select_authenticated"
on public.feed_replies for select
to authenticated
using (true);

drop policy if exists "feed_replies_insert_own" on public.feed_replies;
create policy "feed_replies_insert_own"
on public.feed_replies for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "feed_replies_delete_own" on public.feed_replies;
create policy "feed_replies_delete_own"
on public.feed_replies for delete
to authenticated
using (auth.uid() = user_id);
