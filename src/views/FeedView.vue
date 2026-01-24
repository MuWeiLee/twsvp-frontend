<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">T</router-link>
        <div class="nav-title">观点流</div>
        <router-link class="nav-btn" to="/search">搜索</router-link>
      </nav>

      <header class="slide-in">
        <div style="display: flex; justify-content: flex-end">
          <a class="nav-btn" href="#publish">发布观点</a>
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
          >
            全部
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'active' }"
            @click="statusFilter = 'active'"
          >
            未结束
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'expired' }"
            @click="statusFilter = 'expired'"
          >
            已结束
          </button>
        </div>

        <div class="tabs tabs-compact">
          <button
            class="tab-btn"
            :class="{ active: sortKey === 'time' }"
            @click="sortKey = 'time'"
          >
            时间
          </button>
          <button
            class="tab-btn"
            :class="{ active: sortKey === 'hot' }"
            @click="sortKey = 'hot'"
          >
            热度
          </button>
        </div>

        <div id="publish" class="composer">
          <div class="composer-top">
            <div class="avatar">{{ user.initials }}</div>
            <div class="composer-text">写下你的观点（标的、方向、时效）</div>
          </div>
          <div class="composer-meta">
            <div>
              <span class="chip">标的：{{ composer.asset }}</span>
              <span class="chip">方向：{{ composer.direction }}</span>
              <span class="chip">时效：{{ composer.horizon }}</span>
            </div>
            <router-link class="btn-primary" to="/create-feed">发布观点</router-link>
          </div>
        </div>
      </header>

      <section class="feed">
        <div v-for="view in filteredViews" :key="view.id" class="thread slide-in">
          <div class="thread-dot" aria-hidden="true"></div>
          <div class="thread-card">
            <div class="thread-header">
              <div class="stock">
                <strong>{{ view.symbol }}</strong>
                <span>{{ view.name }}</span>
              </div>
              <span class="status">{{ view.statusLabel }}</span>
            </div>
            <div class="thread-meta">
              <span class="direction">{{ view.direction }}</span>
              <span>{{ view.horizon }}</span>
              <span>作者 {{ view.author }}</span>
            </div>
            <div class="summary">{{ view.summary }}</div>
            <div class="thread-footer">
              <span>赞 {{ view.likes }}</span>
              <span>{{ view.createdAt }}</span>
            </div>
          </div>
        </div>
      </section>

      <p class="legal">
        广场仅展示观点记录与回溯，不构成任何投资建议。
      </p>

      <nav class="tabbar">
        <router-link class="tab-item" active-class="active" to="/feed">观点流</router-link>
        <router-link class="tab-item" active-class="active" to="/search">搜索</router-link>
        <router-link class="tab-item" active-class="active" to="/create-feed">发布</router-link>
        <router-link class="tab-item" active-class="active" to="/notifications">通知</router-link>
        <router-link class="tab-item" active-class="active" to="/profile">个人中心</router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const statusFilter = ref("all");
const sortKey = ref("time");
const user = ref({
  initials: "林",
});
const composer = ref({
  asset: "2330 台积电",
  direction: "看多",
  horizon: "10 个交易日",
});
const views = ref([
  {
    id: 1,
    symbol: "2330",
    name: "台积电",
    direction: "看多",
    horizon: "10 个交易日",
    author: "林可心",
    createdAt: "刚刚",
    likes: 18,
    summary: "法说会后动能持续，关注外资回补与量能变化。",
    status: "active",
    hotScore: 42,
  },
  {
    id: 2,
    symbol: "2454",
    name: "联发科",
    direction: "中性",
    horizon: "5 个交易日",
    author: "陈映帆",
    createdAt: "10 分钟前",
    likes: 6,
    summary: "区间震荡为主，等待新一轮催化确定方向。",
    status: "active",
    hotScore: 28,
  },
  {
    id: 3,
    symbol: "2603",
    name: "长荣",
    direction: "看空",
    horizon: "20 个交易日",
    author: "张以安",
    createdAt: "1 小时前",
    likes: 21,
    summary: "运价回落压力增大，短期风险偏高。",
    status: "expired",
    hotScore: 19,
  },
  {
    id: 4,
    symbol: "2382",
    name: "广达",
    direction: "看多",
    horizon: "10 个交易日",
    author: "周知晓",
    createdAt: "3 小时前",
    likes: 28,
    summary: "订单能见度提升，关注财报后的估值修复。",
    status: "active",
    hotScore: 66,
  },
  {
    id: 5,
    symbol: "2308",
    name: "台达电",
    direction: "中性",
    horizon: "10 个交易日",
    author: "何雨静",
    createdAt: "今天",
    likes: 9,
    summary: "短线波动大，等待量价关系进一步明确。",
    status: "expired",
    hotScore: 12,
  },
]);

const filteredViews = computed(() => {
  const filtered = views.value.filter((view) => {
    if (statusFilter.value === "all") {
      return true;
    }
    return view.status === statusFilter.value;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey.value === "hot") {
      return b.hotScore - a.hotScore;
    }
    return b.id - a.id;
  });
  return sorted.map((view) => ({
    ...view,
    statusLabel: view.status === "active" ? "未结束" : "已结束",
  }));
});

</script>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  background: transparent;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
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
  background: var(--surface);
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
  background: var(--surface);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
}

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--ink);
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  color: #fff;
  border: 1px solid var(--border);
  text-decoration: none;
}

.tabs {
  margin-top: 14px;
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

.tabs-compact {
  margin-top: 8px;
  gap: 12px;
}

.composer {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  display: grid;
  gap: 12px;
  background: var(--surface);
}

.composer-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--panel);
  display: grid;
  place-items: center;
  font-weight: 600;
}

.composer-text {
  flex: 1;
  font-size: 14px;
  color: var(--muted);
}

.composer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid var(--border);
  margin-right: 6px;
}

.btn-primary {
  border: 0;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.feed {
  margin-top: 18px;
  display: grid;
  gap: 16px;
}

.thread {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
  align-items: start;
}

.thread-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ink);
  margin-top: 6px;
}

.thread-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.thread-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.direction {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
  color: var(--ink);
}

.thread-footer {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--muted);
}

.stock {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-weight: 600;
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

.legal {
  margin-top: 16px;
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
  min-height: 56px;
  padding: 10px 6px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: var(--surface);
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

.fade-in {
  animation: fadeIn 650ms ease both;
}

.slide-in {
  animation: slideUp 500ms ease both;
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

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }

  .composer-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-primary {
    width: 100%;
  }
}
</style>
