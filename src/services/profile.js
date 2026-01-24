import { supabase } from "./supabase";

export async function getProfileSupabase(userId) {
  if (!userId) {
    return null;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nickname, bio, avatar_url, profile_completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("获取 profile 失败:", error);
    return null;
  }

  return data;
}

export async function getIndustriesSupabase() {
  const { data, error } = await supabase
    .from("industries")
    .select("industry_id, name, order_no")
    .eq("is_active", true)
    .order("order_no", { ascending: true });

  if (error) {
    console.error("获取 industries 失败:", error);
    return [];
  }

  return data || [];
}

export async function getUserIndustriesSupabase(userId) {
  if (!userId) {
    return [];
  }
  const { data, error } = await supabase
    .from("user_industries")
    .select("industry_id")
    .eq("user_id", userId);

  if (error) {
    console.error("获取 user_industries 失败:", error);
    return [];
  }

  return data || [];
}

export async function upsertProfileSupabase({ userId, nickname, bio, avatarUrl, completed }) {
  if (!userId) {
    return null;
  }
  const payload = {
    user_id: userId,
    nickname,
    bio: bio || null,
    avatar_url: avatarUrl || null,
  };

  if (completed) {
    payload.profile_completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("更新 profile 失败:", error);
    return null;
  }

  return data;
}

export async function setUserIndustriesSupabase(userId, industryIds) {
  if (!userId) {
    return false;
  }
  const { error: deleteError } = await supabase
    .from("user_industries")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("清理 user_industries 失败:", deleteError);
    return false;
  }

  if (!industryIds || industryIds.length === 0) {
    return true;
  }

  const rows = industryIds.map((industryId) => ({
    user_id: userId,
    industry_id: industryId,
  }));

  const { error: insertError } = await supabase.from("user_industries").insert(rows);
  if (insertError) {
    console.error("写入 user_industries 失败:", insertError);
    return false;
  }
  return true;
}
