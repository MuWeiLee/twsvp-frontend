import { supabase } from "./supabase";

export async function getProfileSupabase(userId) {
  if (!userId) {
    return null;
  }
  const { data, error } = await supabase
    .from("users")
    .select("user_id, nickname, bio, avatar_url, language, profile_completed_at, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("获取 users 失败:", error);
  }

  if (data) {
    return data;
  }

  const { data: legacy, error: legacyError } = await supabase
    .from("profiles")
    .select("user_id, nickname, bio, avatar_url, language, profile_completed_at, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyError) {
    console.error("获取 profiles 失败:", legacyError);
    return null;
  }

  return legacy;
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

export async function getIndustryGroupsSupabase() {
  const { data, error } = await supabase
    .from("industry_groups")
    .select("group_id, name, order_no")
    .eq("is_active", true)
    .order("order_no", { ascending: true });

  if (error) {
    console.error("获取 industry_groups 失败:", error);
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

export async function getUserGroupsSupabase(userId) {
  if (!userId) {
    return [];
  }
  const { data, error } = await supabase
    .from("user_groups")
    .select("group_id")
    .eq("user_id", userId);

  if (error) {
    console.error("获取 user_groups 失败:", error);
    return [];
  }

  return data || [];
}

export async function upsertProfileSupabase({
  userId,
  nickname,
  bio,
  avatarUrl,
  language,
  completed,
}) {
  if (!userId) {
    return null;
  }
  const payload = { user_id: userId };
  if (nickname !== undefined) payload.nickname = nickname;
  if (bio !== undefined) payload.bio = bio ? bio : null;
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl ? avatarUrl : null;
  if (language !== undefined) payload.language = language || null;

  if (completed) {
    payload.profile_completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("更新 users 失败:", error);
    const { data: legacy, error: legacyError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (legacyError) {
      console.error("更新 profiles 失败:", legacyError);
      return null;
    }

    return legacy;
  }

  const { error: legacyError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (legacyError) {
    console.warn("同步 profiles 失败:", legacyError);
  }

  return data;
}

export async function setUserGroupsSupabase(userId, groupIds) {
  if (!userId) {
    return false;
  }
  const { error: deleteError } = await supabase
    .from("user_groups")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("清理 user_groups 失败:", deleteError);
    return false;
  }

  if (!groupIds || groupIds.length === 0) {
    return true;
  }

  const rows = groupIds.map((groupId) => ({
    user_id: userId,
    group_id: groupId,
  }));

  const { error: insertError } = await supabase.from("user_groups").insert(rows);
  if (insertError) {
    console.error("写入 user_groups 失败:", insertError);
    return false;
  }
  return true;
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

export async function getUserGroupNamesSupabase(userId) {
  if (!userId) {
    return [];
  }

  const [groups, userGroups] = await Promise.all([
    getIndustryGroupsSupabase(),
    getUserGroupsSupabase(userId),
  ]);

  if (!groups.length || !userGroups.length) {
    return [];
  }

  const nameMap = new Map(groups.map((group) => [group.group_id, group.name]));
  return userGroups
    .map((item) => nameMap.get(item.group_id))
    .filter((name) => Boolean(name));
}

export async function searchUsersSupabase(keyword, limit = 20) {
  if (!keyword) {
    return [];
  }

  const { data, error } = await supabase
    .from("users")
    .select("user_id, nickname, bio, profile_completed_at, created_at")
    .ilike("nickname", `%${keyword}%`)
    .limit(limit);

  if (error) {
    console.error("搜索 users 失败:", error);
  }

  if (data && data.length) {
    return data;
  }

  const { data: legacy, error: legacyError } = await supabase
    .from("profiles")
    .select("user_id, nickname, bio, profile_completed_at, created_at")
    .ilike("nickname", `%${keyword}%`)
    .limit(limit);

  if (legacyError) {
    console.error("搜索 profiles 失败:", legacyError);
    return [];
  }

  return legacy || [];
}
