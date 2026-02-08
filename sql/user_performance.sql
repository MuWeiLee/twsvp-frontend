-- user_performance table
create table if not exists public.user_performance (
  user_id uuid not null,
  window_days integer not null,
  as_of_date date not null,
  feed_count integer not null default 0,
  avg_performance numeric(10, 4) null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_performance_pkey primary key (user_id, window_days, as_of_date),
  constraint user_performance_user_id_fkey foreign key (user_id) references users (user_id) on delete cascade
) tablespace pg_default;

create index if not exists idx_user_performance_user_id on public.user_performance (user_id);
create index if not exists idx_user_performance_window_days on public.user_performance (window_days);
create index if not exists idx_user_performance_as_of_date on public.user_performance (as_of_date desc);

create trigger trg_user_performance_updated_at before
update on public.user_performance for each row
execute function set_updated_at();

-- helper function to recompute user performance
create or replace function public.sync_user_performance(window_days integer[], as_of_date date)
returns void
language plpgsql
as $$
begin
  insert into public.user_performance (user_id, window_days, as_of_date, feed_count, avg_performance)
  select
    f.user_id,
    w.window_days,
    as_of_date,
    count(fp.feed_id) as feed_count,
    avg(fp.performance_pct) as avg_performance
  from public.feeds f
  join public.feed_performance fp
    on fp.feed_id = f.feed_id
  cross join unnest(window_days) as w(window_days)
  where fp.end_date >= as_of_date - (w.window_days - 1)
    and fp.end_date <= as_of_date
  group by f.user_id, w.window_days;
end;
$$;
