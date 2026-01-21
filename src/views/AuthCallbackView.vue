<template>
  <div class="auth-callback">正在登录...</div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { 
  clearAuthCache, 
  getCurrentUserSupabase 
} from "../services/auth.js";
import { supabase } from "../services/supabase.js";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  try {
    const code = route.query.code;
    if (Array.isArray(code)) {
      router.replace("/login");
      return;
    }

    const { data: { session }, error: supabaseError } = await supabase.auth.getSession();
    
    if (supabaseError) {
      console.error('Supabase getSession error:', supabaseError);
    }
    
    const user = session?.user ? session.user : await getCurrentUserSupabase();
    if (user) {
      router.replace("/feed");
      return;
    }

    router.replace("/login");
  } catch (error) {
    console.error('登录失败:', error);
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
