const API_BASE = "https://api.twsvp.com";
const AUTH_CACHE_MS = 60000;
const TOKEN_KEY = "twsvp_token";

import { supabase } from './supabase';

let cachedUser = null;
let checkedAt = 0;

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

  if (!force && checkedAt && now - checkedAt < AUTH_CACHE_MS) {
    return cachedUser;
  }

  if (!token) {
    cachedUser = null;
    checkedAt = now;
    return cachedUser;
  }

  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      cachedUser = null;
    } else {
      const data = await response.json();
      cachedUser = data && data.user ? data.user : null;
    }
  } catch (error) {
    cachedUser = null;
  }

  checkedAt = now;
  return cachedUser;
}

export function clearAuthCache() {
  cachedUser = null;
  checkedAt = 0;
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
  cachedUser = data.user || null;
  checkedAt = Date.now();
  return data;
}

// 使用Supabase进行Google登录
export async function signInWithGoogleSupabase() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
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
export async function getCurrentUserSupabase() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      throw error;
    }
    
    cachedUser = user || null;
    checkedAt = Date.now();
    return user;
  } catch (error) {
    console.error('获取用户失败:', error);
    cachedUser = null;
    return null;
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
