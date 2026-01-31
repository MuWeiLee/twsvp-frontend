-- 用户关注个股
CREATE TABLE IF NOT EXISTS public.user_stock_follows (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stock_symbol text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stock_symbol)
);

CREATE INDEX IF NOT EXISTS user_stock_follows_user_id_idx
  ON public.user_stock_follows (user_id);

CREATE INDEX IF NOT EXISTS user_stock_follows_symbol_idx
  ON public.user_stock_follows (stock_symbol);

-- 用户关注用户
CREATE TABLE IF NOT EXISTS public.user_follows (
  id bigserial PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx
  ON public.user_follows (follower_id);

CREATE INDEX IF NOT EXISTS user_follows_followee_id_idx
  ON public.user_follows (followee_id);
