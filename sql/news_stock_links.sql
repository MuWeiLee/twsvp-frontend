create table if not exists public.news_stock_links (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references public.news_articles(article_id) on delete cascade,
  stock_id text not null references public.stocks(stock_id) on delete cascade,
  matched_text text not null,
  match_method text not null default 'exact_name',
  created_at timestamptz not null default now()
);

create unique index if not exists news_stock_links_unique
  on public.news_stock_links (article_id, stock_id, match_method);

create index if not exists news_stock_links_article_id_idx
  on public.news_stock_links (article_id);

create index if not exists news_stock_links_stock_id_idx
  on public.news_stock_links (stock_id);
