import { supabase } from "./supabase";

const DIRECTION_LABELS = {
  long: "看多",
  short: "看空",
  neutral: "中性",
};

const HORIZON_LABELS = {
  short: "短期 5-20天",
  medium: "中期 20-60天",
  long: "长期 60-180天",
};

const DIRECTION_VALUES = Object.fromEntries(
  Object.entries(DIRECTION_LABELS).map(([key, value]) => [value, key])
);

const HORIZON_VALUES = Object.fromEntries(
  Object.entries(HORIZON_LABELS).map(([key, value]) => [value, key])
);

export const mapDirectionToLabel = (value) => DIRECTION_LABELS[value] || value;
export const mapLabelToDirection = (label) => DIRECTION_VALUES[label] || "neutral";
export const mapHorizonToLabel = (value) => HORIZON_LABELS[value] || value;
export const mapLabelToHorizon = (label) => HORIZON_VALUES[label] || "short";

const horizonDays = {
  short: 20,
  medium: 60,
  long: 180,
};

const getExpiresAt = (horizon) => {
  const days = horizonDays[horizon] || 10;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
};

const buildSummary = (content) => {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  return trimmed.split("\n")[0].slice(0, 120);
};

export async function createFeedSupabase({
  userId,
  targetSymbol,
  targetName,
  direction,
  horizon,
  content,
  visibility = "public",
}) {
  const payload = {
    user_id: userId,
    target_type: "stock",
    target_symbol: targetSymbol,
    target_name: targetName,
    direction,
    horizon,
    summary: buildSummary(content),
    content,
    status: "active",
    visibility,
    expires_at: getExpiresAt(horizon),
  };

  const { data, error } = await supabase
    .from("feeds")
    .insert(payload)
    .select(
      "feed_id, user_id, target_symbol, target_name, direction, horizon, content, summary, status, expires_at, created_at, like_count"
    )
    .single();

  if (error) {
    console.error("创建 feeds 失败:", error);
    throw error;
  }

  return data;
}

export async function fetchFeedsSupabase({ status = "all", sort = "time", userId } = {}) {
  let query = supabase
    .from("feeds")
    .select(
      "feed_id, user_id, target_symbol, target_name, direction, horizon, content, summary, status, expires_at, created_at, like_count, users!feeds_user_id_fkey(nickname, avatar_url)"
    )
    .is("deleted_at", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (sort === "hot") {
    query = query.order("like_count", { ascending: false }).order("created_at", {
      ascending: false,
    });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error("读取 feeds 失败:", error);
    return [];
  }

  return data || [];
}

export async function fetchFeedByIdSupabase(feedId) {
  if (!feedId) {
    return null;
  }

  const { data, error } = await supabase
    .from("feeds")
    .select(
      "feed_id, user_id, target_symbol, target_name, direction, horizon, content, summary, status, expires_at, created_at, like_count, users!feeds_user_id_fkey(nickname, avatar_url)"
    )
    .eq("feed_id", feedId)
    .maybeSingle();

  if (error) {
    console.error("读取 feed 失败:", error);
    return null;
  }

  return data;
}

export async function updateFeedLikeCountSupabase(feedId, delta) {
  const { error } = await supabase.rpc("bump_feed_like", {
    p_feed_id: feedId,
    p_delta: delta,
  });

  if (error) {
    console.error("更新点赞失败:", error);
    return false;
  }

  return true;
}

export async function searchFeedsSupabase(query, limit = 15) {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("feeds")
    .select(
      "feed_id, user_id, target_symbol, target_name, direction, horizon, content, summary, status, expires_at, created_at, like_count, users!feeds_user_id_fkey(nickname, avatar_url)"
    )
    .is("deleted_at", null)
    .or(
      `content.ilike.%${q}%,summary.ilike.%${q}%,target_name.ilike.%${q}%,target_symbol.ilike.%${q}%`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return data || [];
}
