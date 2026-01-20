<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <router-link class="nav-btn" to="/profile">返回</router-link>
        <div class="nav-title">设置</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <header class="slide-in">
        <div class="brand">
          <div class="logo">T</div>
          <div>
            <div>TWSVP</div>
            <div style="font-size: 12px; color: var(--muted)">设置</div>
          </div>
        </div>
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
          <button class="btn-outline" @click="handleAccount">管理账号</button>
        </div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>登录验证</strong>
            <span>仅允许 Google OAuth 登录</span>
          </div>
          <span class="tag">已锁定</span>
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
        <div class="setting-item">
          <div class="setting-meta">
            <strong>热门话题提醒</strong>
            <span>当关注话题变热时提醒</span>
          </div>
          <div
            class="switch"
            :class="{ active: preferences.trendingNotice }"
            @click="toggle('trendingNotice')"
            role="switch"
            :aria-checked="preferences.trendingNotice"
            aria-label="热门话题提醒"
          ></div>
        </div>

        <div class="section-title">隐私与内容</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>观点展示范围</strong>
            <span>{{ visibilityLabel }}</span>
          </div>
          <button class="btn-outline" @click="cycleVisibility">切换</button>
        </div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>屏蔽词管理</strong>
            <span>已设置 {{ preferences.blockedKeywords.length }} 个关键词</span>
          </div>
          <button class="btn-outline" @click="handleBlocked">编辑</button>
        </div>

        <div class="section-title">退出</div>
        <div class="setting-item">
          <div class="setting-meta">
            <strong>退出当前账号</strong>
            <span>将在本设备清除会话</span>
          </div>
          <button class="btn-danger" @click="handleLogout">退出</button>
        </div>

        <p class="legal">TWSVP 不提供投资建议，所有观点仅用于记录与回溯。</p>
      </section>

      <nav class="tabbar">
        <router-link class="tab-item" active-class="active" to="/feed">广场</router-link>
        <router-link class="tab-item" active-class="active" to="/search">搜索</router-link>
        <router-link class="tab-item" :to="{ path: '/feed', hash: '#publish' }">
          发布
        </router-link>
        <router-link class="tab-item" active-class="active" to="/notifications">通知</router-link>
        <router-link class="tab-item" active-class="active" to="/profile">我的</router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import { signOutSupabase } from "../services/auth.js";

const router = useRouter();

const account = reactive({
  email: "twsv.user@gmail.com",
});

const preferences = reactive({
  settlementNotice: true,
  trendingNotice: false,
  visibilityIndex: 0,
  visibilityOptions: ["公开展示", "仅自己可见", "隐藏历史观点"],
  blockedKeywords: ["荐股", "保证收益"],
});

const visibilityLabel = computed(
  () => preferences.visibilityOptions[preferences.visibilityIndex]
);

const toggle = (key) => {
  preferences[key] = !preferences[key];
};

const cycleVisibility = () => {
  const count = preferences.visibilityOptions.length;
  preferences.visibilityIndex = (preferences.visibilityIndex + 1) % count;
};

const handleAccount = () => {
  alert("账号管理示例：跳转到 Google 账户设置。");
};

const handleBlocked = () => {
  alert("屏蔽词管理示例：打开关键词编辑弹窗。");
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
</script>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  background: var(--card);
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--card);
  border-radius: 0;
  box-shadow: none;
  padding: 72px 20px 96px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 5;
}

.nav-title {
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  font-size: 16px;
}

.nav-btn {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
}

.nav-space {
  width: 46px;
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

.card {
  background: #fff;
  border-radius: var(--radius);
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

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #f3f4f6;
  color: #111;
}

.switch {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #e6e6e6;
  position: relative;
  transition: background 150ms ease;
  cursor: pointer;
}

.switch::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  left: 3px;
  transition: transform 150ms ease;
}

.switch.active {
  background: #111;
}

.switch.active::after {
  transform: translateX(18px);
}

.btn-outline {
  border: 1px solid var(--border);
  background: #f7f7f7;
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger {
  border: 0;
  background: #111;
  color: #fff;
  border-radius: 14px;
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

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  bottom: 0;
  margin-top: 0;
  min-height: 48px;
  padding: 12px 6px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: #fff;
  border-top: 1px solid var(--border);
  z-index: 5;
}

.tab-item {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  display: block;
  width: 100%;
}

.tab-item.active {
  color: var(--ink);
  font-weight: 600;
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
