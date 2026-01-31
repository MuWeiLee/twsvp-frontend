<template>
  <div class="phone-frame fade-in">
    <nav class="nav">
      <div class="nav-brand">
        <div class="nav-logo">
          <img class="nav-logo-img" :src="logoUrl" alt="TWSVP" />
        </div>
        <div class="nav-text">
          <div class="nav-name">TWSVP</div>
          <div class="nav-slogan">{{ t("让你观点的价值被看见") }}</div>
        </div>
      </div>
      <span class="nav-space" aria-hidden="true"></span>
    </nav>

    <header class="hero slide-in">
      <h1 class="hero-title">
        <span class="hero-rotate" aria-live="polite">
          <span class="hero-rotate-inner">
            <span>{{ t("验证") }}</span>
            <span>{{ t("挖掘") }}</span>
            <span>{{ t("记录") }}</span>
          </span>
        </span>
        <span class="hero-title-rest">{{ t("每一个投资观点") }}</span>
      </h1>
      <div class="hero-flow">
        <span>{{ t("挖掘") }}</span>
        <span class="hero-arrow">-&gt;</span>
        <span>{{ t("记录") }}</span>
        <span class="hero-arrow">-&gt;</span>
        <span>{{ t("验证") }}</span>
      </div>
      <p class="hero-note">
        {{ t("请使用 Safari / Chrome 浏览器开启并登录") }}
      </p>
    </header>

    <section class="feature-card slide-in">
      <div class="feature-text">
        <h2 class="section-title">{{ t("挖掘资讯") }}</h2>
        <p class="section-subtitle">
          {{ t("聚焦台股市场的新闻资讯") }}
        </p>
      </div>
      <div class="feature-media">
        <img src="/news.jpeg" alt="台股新闻资讯" />
      </div>
    </section>

    <section class="feature-card split slide-in">
      <div class="feature-text">
        <h2 class="section-title">{{ t("记录观点") }}</h2>
        <div class="steps">
          <div class="step-item">
            <div class="step-title">{{ t("1. 选择标的") }}</div>
            <div class="step-sub">{{ t("支持台股标的的快速检索") }}</div>
          </div>
          <div class="step-item">
            <div class="step-title">{{ t("2. 看多还是看空") }}</div>
            <div class="step-sub">
              {{ t("选择看多、看空或保持中性观望") }}
            </div>
          </div>
          <div class="step-item">
            <div class="step-title">{{ t("3. 设置观点时效") }}</div>
            <div class="step-sub">
              {{ t("观点时效可长可短，自动计算观点绩效") }}
            </div>
          </div>
        </div>
      </div>
      <div class="feature-media">
        <img src="/post.jpeg" alt="记录观点流程" />
      </div>
    </section>

    <section class="feature-card split reverse slide-in">
      <div class="feature-media">
        <img src="/trade.jpeg" alt="设置交易券商" />
      </div>
      <div class="feature-text">
        <h2 class="section-title">{{ t("设置交易") }}</h2>
        <p class="section-subtitle">
          {{ t("设置交易券商，看到观点立即跳转App") }}
        </p>
      </div>
    </section>

    <section class="feature-card slide-in">
      <div class="feature-text">
        <h2 class="section-title">{{ t("验证观点") }}</h2>
        <p class="section-subtitle">
          {{ t("自动/手动计算绩效，验证观点的准确性") }}
        </p>
      </div>
      <div class="feature-media">
        <img src="/feed.jpeg" alt="观点验证与绩效" />
      </div>
    </section>

    <footer class="footer slide-in">
      <div class="footer-line">
        ins：
        <a
          class="footer-link"
          href="https://www.instagram.com/pai_product?igsh=ZDV0cG5nMXlobGRm&utm_source=qr"
          target="_blank"
          rel="noreferrer"
        >
          pai_product
        </a>
      </div>
      <div class="footer-line">
        email：
        <a class="footer-link" href="mailto:pai.product.manager@gmail.com">
          pai.product.manager@gmail.com
        </a>
      </div>
      <div class="footer-line">Build by Codex, Trae, Gemini</div>
    </footer>

    <section class="login-drawer">
      <div class="drawer-content">
        <div class="drawer-title">{{ t("使用Google账号安全登录") }}</div>
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
          {{ t("使用Google登录") }}
        </button>

        <p class="legal">
          {{ t("继续即表示你同意") }}
          <router-link class="legal-link" to="/agreement/user">
            {{ t("《用户协议》") }}
          </router-link>
          ，{{ t("并确认已阅读") }}
          <router-link class="legal-link" to="/agreement/privacy">
            {{ t("《隐私政策》") }}
          </router-link>
          。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import logoUrl from "../assets/logo.png";
import { useRouter } from "vue-router";
import { t } from "../services/i18n.js";
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
  padding: 76px 22px 220px;
  position: relative;
  max-width: 600px;
  margin: 0 auto;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 6;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-logo {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
}

.nav-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.nav-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-name {
  font-size: 14px;
  font-weight: 600;
}

.nav-slogan {
  font-size: 10px;
  color: var(--muted);
}

.nav-space {
  margin-left: auto;
}

.hero {
  margin-bottom: 20px;
  display: grid;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 18px;
  text-align: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  border-radius: 0;
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
      rgba(18, 20, 23, 0.18) 1px,
      transparent 1px
    ),
    radial-gradient(rgba(118, 187, 64, 0.22) 1px, transparent 1px);
  background-size: 12px 12px, 22px 22px;
  background-position: 0 0, 40px 30px;
  opacity: 0.35;
  pointer-events: none;
}

.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 70% 20%,
    rgba(118, 187, 64, 0.12),
    transparent 55%
  );
  pointer-events: none;
}

.hero > * {
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 26px;
  margin: 6px 0 2px;
  letter-spacing: -0.02em;
  font-weight: 700;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.hero-rotate {
  display: inline-block;
  height: 1.1em;
  overflow: hidden;
  border-bottom: 2px solid var(--ink);
  padding: 0 2px;
}

.hero-rotate-inner {
  display: block;
  animation: rotateWords 6s infinite;
}

.hero-rotate-inner span {
  display: block;
  height: 1.1em;
}

.hero-title-rest {
  display: inline-block;
}

.hero-flow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  padding: 6px 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  width: fit-content;
  justify-self: center;
}

.hero-arrow {
  color: var(--muted);
  font-weight: 500;
}

.hero-note {
  color: var(--muted);
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.feature-card {
  background: var(--surface);
  border-radius: 0;
  padding: 18px;
  border: 1px solid var(--border);
  position: relative;
  z-index: 1;
  margin-bottom: 18px;
  display: grid;
  gap: 16px;
}

.split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
}

.split.reverse {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.feature-text {
  display: grid;
  gap: 10px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-subtitle {
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
  font-size: 13px;
}

.feature-media {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-media img {
  width: 100%;
  height: auto;
  border-radius: 0;
  display: block;
  object-fit: cover;
}

.steps {
  display: grid;
  gap: 12px;
}

.step-item {
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 0;
  display: grid;
  gap: 4px;
}

.step-title {
  font-size: 13px;
  font-weight: 600;
}

.step-sub {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.btn {
  border: 1px solid var(--border);
  border-radius: 0;
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
  margin-top: 8px;
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
  margin-top: 12px;
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

.footer {
  text-align: center;
  margin-top: 8px;
  padding: 16px 0 0;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  display: grid;
  gap: 6px;
}

.footer-line {
  line-height: 1.4;
}

.footer-link {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.login-drawer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 600px;
  background: var(--surface);
  border-top: 2px solid var(--ink);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 18px rgba(15, 20, 25, 0.08);
  z-index: 10;
}

.drawer-content {
  padding: 16px 22px 18px;
  display: grid;
  gap: 6px;
}

.drawer-title {
  font-weight: 600;
  font-size: 14px;
}

@keyframes rotateWords {
  0%,
  20% {
    transform: translateY(0%);
  }
  33%,
  53% {
    transform: translateY(-100%);
  }
  66%,
  86% {
    transform: translateY(-200%);
  }
  100% {
    transform: translateY(0%);
  }
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
    padding: 72px 18px 240px;
  }

  .hero-title {
    font-size: 22px;
  }

  .split,
  .split.reverse {
    grid-template-columns: 1fr;
  }

  .drawer-content {
    padding: 14px 18px 16px;
  }
}
</style>
