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
  const state = route.query.state;

  if (!code || Array.isArray(code)) {
    router.replace("/login");
    return;
  }

  try {
    // 检查是否是 Supabase OAuth 回调
    // Supabase 回调通常包含 code 和可能的 state 参数
    // 我们可以通过检查 URL 或查询参数来判断
    
    // 尝试处理 Supabase OAuth 回调
    const { data: { session }, error: supabaseError } = await supabase.auth.getSession();
    
    if (supabaseError) {
      console.error('Supabase getSession error:', supabaseError);
    }
    
    // 如果已经有 Supabase session，说明是 Supabase OAuth 回调
    if (session) {
      console.log('Supabase OAuth 登录成功:', session);
      
      // 获取当前用户信息
      const user = await getCurrentUserSupabase();
      if (user) {
        console.log('获取 Supabase 用户成功:', user);
        router.replace("/feed");
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
  font-family: "Inter", "Source Han Serif", "Noto Serif SC", sans-serif;
  color: var(--ink);
  background: var(--bg);
}
</style>
