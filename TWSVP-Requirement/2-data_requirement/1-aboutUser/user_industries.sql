-- 4) 用户-行业关系表：public.user_industries
create table if not exists public.user_industries (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  industry_id bigint not null references public.industries(industry_id),

  created_at timestamptz not null default now(),

  primary key (user_id, industry_id)
);

create index if not exists idx_user_industries_user_id on public.user_industries(user_id);
create index if not exists idx_user_industries_industry_id on public.user_industries(industry_id);
