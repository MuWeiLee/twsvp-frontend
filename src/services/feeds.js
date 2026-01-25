import { supabase } from "./supabase";

const DIRECTION_LABELS = {
  long: "看多",
  short: "看空",
  neutral: "中性",
};

const HORIZON_LABELS = {
  ultra_short: "极短期 5天内",
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

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const pad2 = (value) => `${value}`.padStart(2, "0");

export const formatFeedTimestamp = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const oneYearAgo = new Date(startOfToday);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (date >= startOfToday) return `今天 ${time}`;
  if (date >= startOfYesterday) return `昨天 ${time}`;
  if (date >= sevenDaysAgo) {
    return `星期${WEEKDAY_LABELS[date.getDay()]} ${time}`;
  }

  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  if (date >= oneYearAgo) return `${month}/${day} ${time}`;
  return `${date.getFullYear()}/${month}/${day} ${time}`;
};

export const HORIZON_RANGES = {
  ultra_short: { min: 0, max: 5 },
  short: { min: 5, max: 20 },
  medium: { min: 20, max: 60 },
  long: { min: 60, max: 180 },
};

export const getElapsedDays = (value) => {
  if (!value) return 0;
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return 0;
  const diff = Date.now() - createdAt;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
};

export const getRemainingDays = (view) => {
  const range = HORIZON_RANGES[view.horizon] || { min: 5, max: 20 };
  const elapsed = getElapsedDays(view.created_at);
  return Math.max(0, range.max - elapsed);
};

export const getStatusPhase = (view) => {
  if (view.status === "expired") return "ended";
  const range = HORIZON_RANGES[view.horizon] || { min: 5, max: 20 };
  const elapsed = getElapsedDays(view.created_at);
  if (elapsed < range.min) return "pending";
  if (elapsed <= range.max) return "active";
  return "ended";
};

export const getStatusLabel = (phase) => {
  if (phase === "ended") return "已结束";
  if (phase === "active") return "进行中";
  return "未开始";
};

export const getStatusDisplay = (view, phase) => {
  if (phase === "ended") return "已结束";
  if (phase === "active") return "进行中";
  return "未开始";
};

const horizonDays = {
  ultra_short: 5,
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

export async function fetchFeedsBySymbolSupabase(symbol, { sort = "time" } = {}) {
  const targetSymbol = String(symbol || "").trim();
  if (!targetSymbol) return [];
  let query = supabase
    .from("feeds")
    .select(
      "feed_id, user_id, target_symbol, target_name, direction, horizon, content, summary, status, expires_at, created_at, like_count, users!feeds_user_id_fkey(nickname, avatar_url)"
    )
    .is("deleted_at", null)
    .eq("target_symbol", targetSymbol);

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

export async function fetchFeedLikesSupabase(userId, feedIds = []) {
  if (!userId || !feedIds.length) {
    return new Set();
  }
  const { data, error } = await supabase
    .from("feed_likes")
    .select("feed_id")
    .eq("user_id", userId)
    .in("feed_id", feedIds);

  if (error) {
    console.error("读取 feed_likes 失败:", error);
    return new Set();
  }

  return new Set((data || []).map((row) => row.feed_id));
}

export async function addFeedLikeSupabase(userId, feedId) {
  if (!userId || !feedId) {
    return false;
  }
  const { error } = await supabase
    .from("feed_likes")
    .upsert({ user_id: userId, feed_id: feedId }, { onConflict: "user_id,feed_id" });

  if (error) {
    console.error("新增 feed_like 失败:", error);
    return false;
  }

  return true;
}

export async function removeFeedLikeSupabase(userId, feedId) {
  if (!userId || !feedId) {
    return false;
  }
  const { error } = await supabase
    .from("feed_likes")
    .delete()
    .eq("user_id", userId)
    .eq("feed_id", feedId);

  if (error) {
    console.error("删除 feed_like 失败:", error);
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
