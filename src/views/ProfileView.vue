<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">T</router-link>
        <div class="nav-title">我的</div>
        <button class="nav-btn" @click="goSettings">设置</button>
      </nav>

      <section class="profile">
        <div class="user-card">
          <div class="avatar">{{ user.initials }}</div>
          <div>
            <div class="name">{{ user.name }}</div>
            <div class="meta">加入于 {{ user.joined }}</div>
          </div>
        </div>

        <div class="stats">
          <div>
            <div class="stat-label">收益率</div>
            <div class="stat-value">{{ performance.returnPct }}</div>
          </div>
          <div>
            <div class="stat-label">胜率</div>
            <div class="stat-value">{{ performance.winRate }}</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: mode === 'active' }"
            @click="mode = 'active'"
          >
            进行中
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'closed' }"
            @click="mode = 'closed'"
          >
            已结算
          </button>
        </div>

        <div class="view-list">
          <div v-for="view in filteredViews" :key="view.id" class="view-item">
            <div class="thread-dot" aria-hidden="true"></div>
            <div class="thread-body">
              <div class="view-header">
                <span>{{ view.asset }}</span>
                <span class="tag">{{ view.horizon }}</span>
              </div>
              <div class="view-meta">
                <span class="direction">{{ view.direction }}</span>
                <span>发布于 {{ view.date }}</span>
                <span>状态：{{ view.statusLabel }}</span>
              </div>
              <div>{{ view.content }}</div>
            </div>
          </div>
        </div>

        <p class="legal">
          仅记录观点与回溯结果，不展示预测价格，也不作为投资建议。
        </p>
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
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const mode = ref("active");
const user = ref({
  initials: "林",
  name: "林可心",
  joined: "2024/08/12",
});
const performance = ref({
  returnPct: "+6.8%",
  winRate: "62%",
});
const views = ref([
  {
    id: 1,
    asset: "2330 台积电",
    direction: "看多",
    horizon: "10 个交易日",
    date: "2024/11/06",
    status: "active",
    statusLabel: "进行中",
    content: "法说会后估值修复，关注量能与外资动向。",
  },
  {
    id: 2,
    asset: "2454 联发科",
    direction: "中性",
    horizon: "5 个交易日",
    date: "2024/11/02",
    status: "active",
    statusLabel: "进行中",
    content: "区间震荡，等待下个催化剂确认方向。",
  },
  {
    id: 3,
    asset: "2603 长荣",
    direction: "看空",
    horizon: "20 个交易日",
    date: "2024/10/15",
    status: "closed",
    statusLabel: "已结算",
    content: "运价回落压力增大，留意航运指数变化。",
  },
  {
    id: 4,
    asset: "3037 欣兴",
    direction: "看多",
    horizon: "10 个交易日",
    date: "2024/10/01",
    status: "closed",
    statusLabel: "已结算",
    content: "AI 需求带动订单，短期均线趋势向上。",
  },
]);

const filteredViews = computed(() =>
  views.value.filter((view) => view.status === mode.value)
);

const goSettings = () => {
  router.push("/settings");
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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
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

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #111;
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  color: #fff;
  border: 0;
  text-decoration: none;
}

.profile {
  display: grid;
  gap: 18px;
}

.user-card {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #f3f4f6;
  display: grid;
  place-items: center;
  font-weight: 600;
}

.name {
  font-weight: 600;
}

.meta {
  font-size: 12px;
  color: var(--muted);
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stats > div {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
}

.stat-label {
  font-size: 12px;
  color: var(--muted);
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
}

.tabs {
  margin-top: 4px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
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

.view-list {
  display: grid;
  gap: 14px;
}

.view-item {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
}

.thread-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #111;
  margin-top: 8px;
}

.thread-body {
  background: #fff;
  border-radius: 16px;
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.view-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #f3f4f6;
  color: #111;
}

.direction {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #111;
  color: #fff;
}

.legal {
  margin-top: 4px;
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

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}
</style>
