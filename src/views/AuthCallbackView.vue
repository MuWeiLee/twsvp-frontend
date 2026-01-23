<template>
  <div class="auth-callback">正在登录...</div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { 
  clearAuthCache, 
  exchangeGoogleCode, 
  setAuthToken, 
  getCurrentUserSupabase 
} from "../services/auth.js";
import { supabase } from "../services/supabase.js";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const code = route.query.code;
  const redirectToFeed = async () => {
    const user = await getCurrentUserSupabase();
    if (user) {
      router.replace("/feed");
      return true;
    }
    return false;
  };

  if (!code || Array.isArray(code)) {
    const { data: fallbackSession } = await supabase.auth.getSession();
    if (fallbackSession?.session && (await redirectToFeed())) {
      return;
    }

    router.replace("/login");
    return;
  }

  try {
    // 处理 Supabase OAuth 回调
    const { data: supabaseSession, error: supabaseError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (supabaseError) {
      console.error("Supabase exchangeCodeForSession error:", supabaseError);
    }

    if (supabaseSession?.session) {
      if (await redirectToFeed()) {
        return;
      }
    }

    const { data: fallbackSession } = await supabase.auth.getSession();
    if (fallbackSession?.session) {
      if (await redirectToFeed()) {
        return;
      }
    }

    // 否则处理传统 OAuth 回调
    await exchangeGoogleCode(code);
    router.replace("/feed");
  } catch (error) {
    console.error('登录失败:', error);
    setAuthToken(null);
    clearAuthCache();
    router.replace("/login");
  }
});
</script>

<style scoped>
.auth-callback {
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  color: var(--ink);
  background: var(--card);
}
</style>
