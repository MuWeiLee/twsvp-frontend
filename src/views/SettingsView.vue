<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <router-link class="nav-btn" to="/profile" aria-label="返回">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </router-link>
        <div class="nav-title">设置</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <header class="slide-in">
        <h1 class="title">个人设置</h1>
        <p class="subtitle">管理你的通知、隐私与账号安全偏好。</p>
      </header>

      <section class="card slide-in">
        <div class="section-title">账号与安全</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>Google 账号</strong>
            <span>{{ account.email }}</span>
          </div>
        </div>

        <div class="section-title">通知偏好</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>观点结算提醒</strong>
            <span>当观点到期或结算时提醒</span>
          </div>
          <div
            class="switch"
            :class="{ active: preferences.settlementNotice }"
            @click="toggle('settlementNotice')"
            role="switch"
            :aria-checked="preferences.settlementNotice"
            aria-label="观点结算提醒"
          ></div>
        </div>

        <div class="section-title">涨跌设置</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>涨跌颜色</strong>
          </div>
          <div class="option-group">
            <button
              class="option-btn"
              :class="{ active: priceScheme === 'red_up' }"
              type="button"
              @click="setPriceScheme('red_up')"
            >
              红涨绿跌
            </button>
            <button
              class="option-btn"
              :class="{ active: priceScheme === 'green_up' }"
              type="button"
              @click="setPriceScheme('green_up')"
            >
              绿涨红跌
            </button>
          </div>
        </div>

        <div class="section-title">协议与隐私</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>用户协议</strong>
            <span>了解平台服务条款</span>
          </div>
          <router-link class="btn-icon" to="/agreement/user" aria-label="用户协议">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </router-link>
        </div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>隐私政策</strong>
            <span>了解信息如何被使用</span>
          </div>
          <router-link class="btn-icon" to="/agreement/privacy" aria-label="隐私政策">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </router-link>
        </div>

        <div class="section-title">退出</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>退出当前账号</strong>
            <span>将在本设备清除会话</span>
          </div>
          <button class="btn-danger" @click="handleLogout">退出</button>
        </div>

        <p class="legal">任何观点仅作为记录与回溯，不作为预测价格与投资建议。</p>
      </section>

    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase, signOutSupabase } from "../services/auth.js";
import { applyPriceScheme, getPriceScheme } from "../services/preferences.js";

const router = useRouter();

const account = reactive({
  email: "—",
});

const preferences = reactive({
  settlementNotice: true,
});

const priceScheme = ref("red_up");

const toggle = (key) => {
  preferences[key] = !preferences[key];
};

const setPriceScheme = (scheme) => {
  priceScheme.value = applyPriceScheme(scheme);
};

const loadAccount = async () => {
  const user = await getCurrentUserSupabase();
  account.email = user?.email || "—";
};

const handleLogout = async () => {
  const confirmed = window.confirm("确定要退出登录吗？");
  if (!confirmed) {
    return;
  }

  const success = await signOutSupabase();
  if (success) {
    await router.replace("/login");
    return;
  }

  alert("退出失败，请稍后重试。");
};

const loadPreferences = () => {
  priceScheme.value = getPriceScheme();
  applyPriceScheme(priceScheme.value);
};

onMounted(loadAccount);
onMounted(loadPreferences);
</script>

<style scoped>
.app-shell {
  max-width: 375px;
  margin: 0 auto;
  background: var(--bg);
  min-height: 100vh;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  padding: 76px 16px 40px;
  position: relative;
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
  max-width: 375px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
}

.nav-title {
  font-weight: 500;
  font-size: 20px;
  margin-right: auto;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  width: 32px;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.nav-space {
  margin-left: auto;
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

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 18px;
  border: 1px solid var(--border);
  display: grid;
  gap: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.option-group {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--panel);
}

.option-btn {
  border: 0;
  background: transparent;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
}

.option-btn + .option-btn {
  border-left: 1px solid var(--border);
}

.option-btn.active {
  background: var(--surface);
  color: var(--ink);
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  text-decoration: none;
}

.btn-icon svg {
  width: 18px;
  height: 18px;
}

.setting-meta {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.setting-meta strong {
  font-size: 14px;
  color: var(--ink);
}

.switch {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: var(--panel);
  position: relative;
  transition: background 150ms ease;
  cursor: pointer;
}

.switch::after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface);
  top: 3px;
  left: 3px;
  transition: transform 150ms ease;
}

.switch.active {
  background: var(--ink);
}

.switch.active::after {
  transform: translateX(18px);
}

.btn-outline {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: var(--ink);
}

.btn-danger {
  border: 0;
  background: var(--ink);
  color: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.legal {
  margin-top: 14px;
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

@media (max-width: 420px) {
  .phone-frame {
    padding: 68px 18px 88px;
  }

  .setting-item {
    align-items: flex-start;
  }
}
</style>
