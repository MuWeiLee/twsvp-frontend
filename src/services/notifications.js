import { supabase } from "./supabase";

export async function fetchNotificationsSupabase(userId, limit = 50) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select(
      "*,feeds(feed_id,target_symbol,target_name,summary,content,expires_at,deleted_at),actor:users!notifications_actor_user_id_fkey(user_id,nickname,avatar_url)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("读取 notifications 失败:", error);
    return [];
  }

  return (data || []).map((row) => ({
    ...row,
    noti_id: row.noti_id || row.notification_id,
    target_feed_id: row.target_feed_id || row.ref_feed_id,
    read_at: row.read_at || (row.is_read ? row.created_at : null),
  }));
}
