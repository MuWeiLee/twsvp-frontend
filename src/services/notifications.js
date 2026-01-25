import { supabase } from "./supabase";

export async function fetchNotificationsSupabase(userId, limit = 50) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("读取 notifications 失败:", error);
    return [];
  }

  const rows = data || [];
  const actorIds = [
    ...new Set(rows.map((row) => row.actor_user_id).filter(Boolean)),
  ];
  const feedIds = [
    ...new Set(
      rows
        .map((row) => row.target_feed_id || row.ref_feed_id)
        .filter(Boolean)
    ),
  ];
  let actorMap = {};
  let feedMap = {};

  if (actorIds.length) {
    const { data: actors, error: actorError } = await supabase
      .from("users")
      .select("user_id,nickname,avatar_url")
      .in("user_id", actorIds);
    if (actorError) {
      console.error("读取通知用户失败:", actorError);
    } else {
      actorMap = Object.fromEntries((actors || []).map((actor) => [actor.user_id, actor]));
    }
  }

  if (feedIds.length) {
    const { data: feeds, error: feedError } = await supabase
      .from("feeds")
      .select(
        "feed_id,target_symbol,target_name,summary,content,expires_at,deleted_at,like_count"
      )
      .in("feed_id", feedIds);
    if (feedError) {
      console.error("读取通知观点失败:", feedError);
    } else {
      feedMap = Object.fromEntries((feeds || []).map((feed) => [feed.feed_id, feed]));
    }
  }

  return rows.map((row) => ({
    ...row,
    noti_id: row.noti_id || row.notification_id,
    target_feed_id: row.target_feed_id || row.ref_feed_id,
    read_at: row.read_at || (row.is_read ? row.created_at : null),
    actor: actorMap[row.actor_user_id] || null,
    feeds: feedMap[row.target_feed_id || row.ref_feed_id] || null,
  }));
}
