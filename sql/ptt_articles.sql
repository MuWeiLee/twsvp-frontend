create table if not exists public.ptt_articles (
  id uuid primary key default gen_random_uuid(),
  article_id text not null,
  board text not null default 'Stock',
  stock_id text not null references public.stocks(stock_id) on delete cascade,
  stock_name text not null,
  title text not null,
  author text,
  published_at timestamptz not null,
  content text,
  url text not null,
  push_label text not null default '',
  net_push integer not null default 0,
  date_hint text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ptt_articles_unique
  on public.ptt_articles (article_id, stock_id);

create index if not exists ptt_articles_stock_published_idx
  on public.ptt_articles (stock_id, published_at desc);

create index if not exists ptt_articles_published_idx
  on public.ptt_articles (published_at desc);

create index if not exists ptt_articles_stock_net_push_published_idx
  on public.ptt_articles (stock_id, net_push desc, published_at desc);
