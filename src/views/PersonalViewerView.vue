<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">个人主页</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="profile">
        <div class="user-card">
          <div class="avatar">{{ user.initials }}</div>
          <div>
            <div class="name">{{ user.name }}</div>
            <div class="meta">{{ user.bio }}</div>
            <div class="tags">
              <span v-for="tag in user.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <div class="meta">加入于 {{ user.joined }}</div>
          </div>
        </div>

        <div class="stats">
          <div>
            <div class="stat-label">观点总数</div>
            <div class="stat-value">{{ stats.totalViews }}</div>
          </div>
          <div>
            <div class="stat-label">已结束</div>
            <div class="stat-value">{{ stats.closedViews }}</div>
          </div>
          <div>
            <div class="stat-label">胜率</div>
            <div class="stat-value">{{ stats.winRate }}</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: mode === 'all' }"
            @click="mode = 'all'"
          >
            全部
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'active' }"
            @click="mode = 'active'"
          >
            未结束
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'closed' }"
            @click="mode = 'closed'"
          >
            已结束
          </button>
        </div>

        <div class="view-list">
          <div v-for="view in filteredViews" :key="view.id" class="view-item">
            <div class="thread-dot" aria-hidden="true"></div>
            <div class="thread-body">
              <div class="view-header">
                <span>{{ view.asset }}</span>
                <span class="status">{{ view.statusLabel }}</span>
              </div>
              <div class="view-meta">
                <span class="direction">{{ view.direction }}</span>
                <span>{{ view.horizon }}</span>
                <span>发布于 {{ view.date }}</span>
              </div>
              <div class="summary">{{ view.content }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const mode = ref("all");
const user = ref({
  initials: "林",
  name: "林可心",
  bio: "专注台股半导体与供应链，偏中短期策略。",
  tags: ["半导体", "AI 供应链", "ETF"],
  joined: "2023/06/18",
});
const stats = ref({
  totalViews: 32,
  closedViews: 12,
  winRate: "待结算",
});
const views = ref([
  {
    id: 1,
    asset: "2330 台积电",
    direction: "看多",
    horizon: "10 个交易日",
    date: "2024/11/06",
    status: "active",
    statusLabel: "未结束",
    content: "法说会后估值修复，关注量能与外资动向。",
  },
  {
    id: 2,
    asset: "2454 联发科",
    direction: "中性",
    horizon: "5 个交易日",
    date: "2024/11/02",
    status: "active",
    statusLabel: "未结束",
    content: "区间震荡，等待下个催化剂确认方向。",
  },
  {
    id: 3,
    asset: "2603 长荣",
    direction: "看空",
    horizon: "20 个交易日",
    date: "2024/10/15",
    status: "closed",
    statusLabel: "已结束",
    content: "运价回落压力增大，留意航运指数变化。",
  },
]);

const filteredViews = computed(() =>
  views.value.filter((view) => (mode.value === "all" ? true : view.status === mode.value))
);
</script>

<style scoped>
.app-shell {
  max-width: 480px;
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
  padding: 72px 20px 40px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
}

.nav-title {
  font-weight: 700;
  font-size: 15px;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
}

.nav-space {
  width: 28px;
}

.profile {
  display: grid;
  gap: 18px;
}

.user-card {
  display: flex;
  gap: 12px;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 14px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--panel);
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
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stats > div {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
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
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--muted);
}

.tab-btn.active {
  color: var(--ink);
  border-color: var(--ink);
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
  background: var(--ink);
  margin-top: 8px;
}

.thread-body {
  background: var(--surface);
  border-radius: var(--radius-card);
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
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--border);
}

.direction {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
  color: var(--ink);
}

.status {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted);
}

.summary {
  color: var(--ink);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
}

@media (max-width: 360px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
