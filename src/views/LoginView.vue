<template>
  <div class="phone-frame fade-in">
    <header class="slide-in">
      <div class="brand">
        <img class="logo" :src="logoUrl" alt="TWSVP" />
        <div>
          <div>TWSVP</div>
          <div style="font-size: 12px; color: var(--muted)">让你观点的价值被看见</div>
        </div>
      </div>
      <h1 class="title">欢迎使用TWSVP</h1>
    </header>

    <section class="login-card slide-in">
      <p class="subtitle" style="margin: 0 0 14px">
        使用 Google 账号快速登录。
      </p>

      <button class="btn btn-google" @click="handleGoogle">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9A5.9 5.9 0 0 1 6.1 12a5.9 5.9 0 0 1 5.9-5.9c1.7 0 2.9.7 3.5 1.4l2.4-2.3C16.4 3.7 14.4 3 12 3 6.9 3 2.8 7.1 2.8 12S6.9 21 12 21c6.9 0 8.7-4.8 8.7-7.2 0-.5-.1-.9-.1-1.3H12z"
          />
          <path
            fill="#34A853"
            d="M3.9 7.2l3.2 2.3A5.9 5.9 0 0 1 12 6.1c1.7 0 2.9.7 3.5 1.4l2.4-2.3C16.4 3.7 14.4 3 12 3c-3.5 0-6.6 2-8.1 4.9z"
          />
          <path
            fill="#FBBC05"
            d="M12 21c2.3 0 4.3-.8 5.7-2.1l-2.7-2.1c-.7.5-1.7.8-3 .8a5.9 5.9 0 0 1-5.6-4H3.2v2.5A9 9 0 0 0 12 21z"
          />
          <path
            fill="#4285F4"
            d="M20.6 12.5c0-.4-.1-.9-.2-1.3H12v3.9h5.5c-.3 1.2-1.2 2.3-2.5 3.1l2.7 2.1c1.6-1.5 2.9-3.8 2.9-7.8z"
          />
        </svg>
        使用 Google 登录
      </button>

      <p class="legal">
        继续即表示你同意
        <router-link class="legal-link" to="/agreement/user">《用户协议》</router-link>
        ，并确认已阅读
        <router-link class="legal-link" to="/agreement/privacy">《隐私政策》</router-link>
        。
      </p>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import logoUrl from "../assets/logo.png";
import { useRouter } from "vue-router";
import {
  ensureProfileSupabase,
  getCurrentUserSupabase,
  getMe,
  getProfileCompletionSupabase,
  signInWithGoogleSupabase,
} from "../services/auth.js";

const router = useRouter();

onMounted(async () => {
  // 优先检查 Supabase 会话，同时兼容旧 token
  const supabaseUser = await getCurrentUserSupabase();
  const user = supabaseUser || (await getMe());
  if (user) {
    if (supabaseUser) {
      await ensureProfileSupabase(supabaseUser);
      const completed = await getProfileCompletionSupabase(supabaseUser.id);
      router.replace(completed ? "/feed" : "/personal-setting");
      return;
    }
    router.replace("/feed");
  }
});

const handleGoogle = () => {
  handleGoogleSupabase();
};

const handleGoogleSupabase = async () => {
  try {
    await signInWithGoogleSupabase();
    console.log('Supabase Google登录请求已发送');
  } catch (error) {
    console.error('Supabase登录失败:', error);
  }
};
</script>

<style scoped>
.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  padding: 32px 22px 40px;
  position: relative;
  max-width: 480px;
  margin: 0 auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  object-fit: contain;
  display: block;
}

.title {
  font-size: 24px;
  margin: 18px 0 6px;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 22px;
  line-height: 1.5;
}

.login-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 20px;
  border: 1px solid var(--border);
  position: relative;
  z-index: 1;
}

.btn {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 160ms ease;
  background: var(--surface);
}

.btn-google {
  width: 100%;
  margin-top: 6px;
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn:hover {
  background: var(--panel);
}

.legal {
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.legal-link {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.slide-in {
  animation: slideUp 500ms ease both;
}

.fade-in {
  animation: fadeIn 650ms ease both;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 420px) {
  .phone-frame {
    padding: 28px 18px 36px;
  }

  .title {
    font-size: 22px;
  }
}
</style>
