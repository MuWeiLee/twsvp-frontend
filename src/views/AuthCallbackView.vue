<template>
  <div class="auth-callback">正在登录...</div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  clearAuthCache,
  ensureProfileSupabase,
  exchangeGoogleCode,
  getCurrentUserSupabase,
  getProfileCompletionSupabase,
  setAuthToken,
} from "../services/auth.js";
import { supabase } from "../services/supabase.js";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  try {
    const code = route.query.code;

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Supabase getSession error:", sessionError);
    }

    let supabaseUser = session?.user || null;

    if (!supabaseUser && code && !Array.isArray(code)) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Supabase exchangeCodeForSession error:", error);
      } else {
        supabaseUser = data?.user || data?.session?.user || null;
      }
    }

    if (supabaseUser) {
      await ensureProfileSupabase(supabaseUser);
      const completed = await getProfileCompletionSupabase(supabaseUser.id);
      router.replace(completed ? "/feed" : "/personal-setting");
      return;
    }

    if (!code || Array.isArray(code)) {
      router.replace("/login");
      return;
    }

    await exchangeGoogleCode(code);
    router.replace("/feed");
  } catch (error) {
    console.error("登录失败:", error);
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
  color: var(--ink);
  background: var(--bg);
}
</style>
