-- public.news_articles: newsdata articles
create table if not exists public.news_articles (
  news_id bigint generated always as identity primary key,
  article_id text not null,
  title text,
  link text,
  description text,
  content text,
  pub_date timestamptz,
  pub_date_tz text,
  creator jsonb,
  keywords jsonb,
  video_url text,
  image_url text,
  source_id text,
  source_url text,
  source_icon text,
  source_priority integer,
  country jsonb,
  category jsonb,
  language text,
  ai_tag text,
  sentiment text,
  sentiment_stats jsonb,
  ai_region jsonb,
  ai_org jsonb,
  duplicate boolean,
  datatype text,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_news_articles_article_id
on public.news_articles(article_id);

create index if not exists idx_news_articles_pub_date
on public.news_articles(pub_date desc);

create index if not exists idx_news_articles_source_id
on public.news_articles(source_id);

create index if not exists idx_news_articles_category
on public.news_articles using gin (category);

create index if not exists idx_news_articles_country
on public.news_articles using gin (country);

alter table public.news_articles enable row level security;

drop policy if exists "news_articles_select_authenticated" on public.news_articles;
create policy "news_articles_select_authenticated"
on public.news_articles for select
to authenticated
using (true);

-- optional: allow anon read if you plan to show news without login
-- drop policy if exists "news_articles_select_anon" on public.news_articles;
-- create policy "news_articles_select_anon"
-- on public.news_articles for select
-- to anon
-- using (true);

-- updated_at trigger (requires public.set_updated_at function)
create trigger trg_news_articles_updated_at
before update on public.news_articles
for each row execute function public.set_updated_at();
