industries 字段说明
字段	类型	必填	说明
industry_id	bigint	✅	自增主键
name	text	✅	行业名称（唯一）
order_no	int	✅	排序用
is_active	boolean	✅	是否可用
created_at / updated_at	timestamptz	✅	记录创建/更新时间

-- 3) 行业基础表：public.industries
create table if not exists public.industries (
  industry_id bigint generated always as identity primary key,
  name text not null unique,
  order_no int not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_industries_updated_at on public.industries;
create trigger trg_industries_updated_at
before update on public.industries
for each row execute function public.set_updated_at();
