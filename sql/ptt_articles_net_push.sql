alter table if exists public.ptt_articles
  add column if not exists net_push integer;

update public.ptt_articles
set net_push = case
  when coalesce(push_label, '') = '爆' then 100
  when coalesce(push_label, '') ~ '^[0-9]+$' then (push_label)::integer
  when coalesce(push_label, '') ~* '^X[0-9]+$' then -substring(push_label from 2)::integer
  else 0
end;

alter table if exists public.ptt_articles
  alter column net_push set default 0;

alter table if exists public.ptt_articles
  alter column net_push set not null;

create index if not exists ptt_articles_stock_net_push_published_idx
  on public.ptt_articles (stock_id, net_push desc, published_at desc);
