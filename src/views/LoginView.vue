<template>
  <div class="phone-frame fade-in">
    <header class="slide-in">
      <div class="brand">
        <div class="logo">T</div>
        <div>
          <div>TWSVP</div>
          <div style="font-size: 12px; color: var(--muted)">Google 登录</div>
        </div>
      </div>
      <h1 class="title">欢迎回来</h1>
      <p class="subtitle">
        继续使用 TWSVP，请通过 Google 账号完成登录或注册。
      </p>
    </header>

    <section class="login-card slide-in">
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
        >
          登录
        </button>
        <button
          class="tab-btn"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>

      <p class="subtitle" style="margin: 0 0 14px">
        {{ 
          mode === "login"
            ? "使用 Google 账号快速登录。"
            : "首次使用请通过 Google 完成注册。"
        }}
      </p>
      
      <!-- Supabase 切换开关 -->
      <div class="toggle-container" style="margin: 0 0 14px; display: flex; align-items: center; justify-content: space-between;">
        <label style="font-size: 14px; color: var(--muted);">使用 Supabase 认证</label>
        <label class="switch">
          <input type="checkbox" v-model="useSupabase" />
          <span class="slider"></span>
        </label>
      </div>
      
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
        {{ mode === "login" ? "使用 Google 登录" : "使用 Google 注册" }} ({{ useSupabase ? 'Supabase' : '传统' }})
      </button>

      <p class="legal">
        继续即表示你同意《服务条款》，并确认已阅读《隐私政策》。
      </p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getMe, signInWithGoogleSupabase, getCurrentUserSupabase } from "../services/auth.js";

const router = useRouter();
const mode = ref("login");
const useSupabase = ref(false);

onMounted(async () => {
  // 检查是否已有用户登录（支持传统认证和Supabase认证）
  const user = await getMe();
  if (!user) {
    // 检查Supabase用户
    await getCurrentUserSupabase();
  }
  
  if (user) {
    router.replace("/feed");
  }
});

const handleGoogle = () => {
  if (useSupabase.value) {
    handleGoogleSupabase();
  } else {
    window.location.href = "https://api.twsvp.com/auth/google/start";
  }
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
  background: var(--card);
  border-radius: 0;
  box-shadow: none;
  padding: 32px 22px 40px;
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: #111;
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  color: #fff;
}

.title {
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-size: 24px;
  margin: 18px 0 6px;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 22px;
  line-height: 1.5;
}

.login-card {
  background: #fff;
  border-radius: var(--radius);
  padding: 20px;
  border: 1px solid var(--border);
  position: relative;
  z-index: 1;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-bottom: 16px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.tab-btn {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 0;
  border-radius: 999px;
  cursor: pointer;
  color: var(--muted);
}

.tab-btn.active {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 6px 16px rgba(15, 20, 25, 0.12);
}

.btn {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px 16px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
  background: #fff;
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
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 20, 25, 0.12);
}

.legal {
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
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

/* 切换开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4285F4;
}

input:focus + .slider {
  box-shadow: 0 0 1px #4285F4;
}

input:checked + .slider:before {
  transform: translateX(20px);
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
