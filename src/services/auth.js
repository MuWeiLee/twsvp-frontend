const API_BASE = "https://api.twsvp.com";
const AUTH_CACHE_MS = 60000;
const SUPABASE_CACHE_MS = 60000;
const PROFILE_CACHE_MS = 5 * 60 * 1000;
const TOKEN_KEY = "twsvp_token";

import { supabase } from './supabase';
import { t } from "./i18n.js";

let cachedApiUser = null;
let apiCheckedAt = 0;
let cachedSupabaseUser = null;
let supabaseCheckedAt = 0;
let cachedProfileCompletion = {
  userId: "",
  value: false,
  checkedAt: 0,
};

export function getAuthToken() {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function getMe(options = {}) {
  const force = options.force === true;
  const now = Date.now();
  const token = getAuthToken();

  if (!force && apiCheckedAt && now - apiCheckedAt < AUTH_CACHE_MS) {
    return cachedApiUser;
  }

  if (!token) {
    cachedApiUser = null;
    apiCheckedAt = now;
    return cachedApiUser;
  }

  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      cachedApiUser = null;
    } else {
      const data = await response.json();
      cachedApiUser = data && data.user ? data.user : null;
    }
  } catch (error) {
    cachedApiUser = null;
  }

  apiCheckedAt = now;
  return cachedApiUser;
}

export function clearAuthCache() {
  cachedApiUser = null;
  apiCheckedAt = 0;
  cachedSupabaseUser = null;
  supabaseCheckedAt = 0;
  cachedProfileCompletion = {
    userId: "",
    value: false,
    checkedAt: 0,
  };
}

export async function exchangeGoogleCode(code) {
  const response = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Google code");
  }

  const data = await response.json();
  if (!data || !data.token) {
    throw new Error("Missing token");
  }

  setAuthToken(data.token);
  cachedApiUser = data.user || null;
  apiCheckedAt = Date.now();
  return data;
}

// 使用Supabase进行Google登录
export async function signInWithGoogleSupabase() {
  try {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Google登录失败:', error);
    throw error;
  }
}

// 使用Supabase获取当前用户
export async function getCurrentUserSupabase(options = {}) {
  const force = options.force === true;
  const now = Date.now();
  if (!force && supabaseCheckedAt && now - supabaseCheckedAt < SUPABASE_CACHE_MS) {
    return cachedSupabaseUser;
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      throw error;
    }
    
    cachedSupabaseUser = user || null;
    supabaseCheckedAt = Date.now();
    return cachedSupabaseUser;
  } catch (error) {
    console.error('获取用户失败:', error);
    cachedSupabaseUser = null;
    return null;
  }
}

export async function ensureProfileSupabase(user) {
  if (!user) {
    return null;
  }

  const nickname =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split("@")[0] : t("新用户"));

  const payload = {
    user_id: user.id,
    nickname,
    avatar_url: user.user_metadata?.avatar_url || null,
  };

  try {
    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("创建 users 失败:", error);
      const { data: legacy, error: legacyError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

      if (legacyError) {
        console.error("创建 profiles 失败:", legacyError);
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
  } catch (error) {
    console.error("创建 users 异常:", error);
    return null;
  }
}

export async function getProfileCompletionSupabase(userId) {
  if (!userId) {
    return false;
  }

  try {
    const now = Date.now();
    if (
      cachedProfileCompletion.userId === userId &&
      now - cachedProfileCompletion.checkedAt < PROFILE_CACHE_MS
    ) {
      return cachedProfileCompletion.value;
    }
    let profile = null;
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("nickname")
      .eq("user_id", userId)
      .maybeSingle();

    if (userError) {
      console.error("读取 users 失败:", userError);
    }

    profile = userRow;

    if (!profile) {
      const { data: legacyRow, error: legacyError } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("user_id", userId)
        .maybeSingle();

      if (legacyError) {
        console.error("读取 profiles 失败:", legacyError);
        return false;
      }
      profile = legacyRow;
    }

    const { count, error: groupError } = await supabase
      .from("user_groups")
      .select("group_id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (groupError) {
      console.error("读取 user_groups 失败:", groupError);
      return false;
    }

    const hasNickname = Boolean(profile && profile.nickname);
    const hasGroups = (count || 0) > 0;
    const completed = hasNickname && hasGroups;
    cachedProfileCompletion = {
      userId,
      value: completed,
      checkedAt: now,
    };
    return completed;
  } catch (error) {
    console.error("检查 profile 完整度失败:", error);
    return false;
  }
}

// 使用Supabase登出
export async function signOutSupabase() {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    setAuthToken(null);
    clearAuthCache();
    return true;
  } catch (error) {
    console.error('登出失败:', error);
    return false;
  }
}
