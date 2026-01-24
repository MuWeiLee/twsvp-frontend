<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">标的观点</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="card">
        <div class="stock-header">
          <strong>{{ stock.symbol }}</strong>
          <span>{{ stock.name }}</span>
        </div>
        <div class="summary">
          近期观点：看多 {{ stock.bullish }} / 看空 {{ stock.bearish }} / 中性
          {{ stock.neutral }}
        </div>
      </section>

      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: filter === 'all' }"
          @click="filter = 'all'"
        >
          全部
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'bullish' }"
          @click="filter = 'bullish'"
        >
          看多
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'bearish' }"
          @click="filter = 'bearish'"
        >
          看空
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'neutral' }"
          @click="filter = 'neutral'"
        >
          中性
        </button>
      </div>

      <section class="list">
        <div v-for="view in filteredViews" :key="view.id" class="item">
          <div class="item-header">
            <span class="direction">{{ view.direction }}</span>
            <span class="status">{{ view.horizon }}</span>
          </div>
          <p class="content">{{ view.summary }}</p>
          <div class="meta">发布于 {{ view.createdAt }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const stock = {
  symbol: "2330",
  name: "台积电",
  bullish: 6,
  bearish: 2,
  neutral: 3,
};

const filter = ref("all");
const views = ref([
  {
    id: 1,
    direction: "看多",
    horizon: "10 个交易日",
    summary: "法说会后动能持续，关注外资回补与量能变化。",
    createdAt: "刚刚",
    key: "bullish",
  },
  {
    id: 2,
    direction: "中性",
    horizon: "5 个交易日",
    summary: "区间震荡为主，等待下一轮催化。",
    createdAt: "1 小时前",
    key: "neutral",
  },
  {
    id: 3,
    direction: "看空",
    horizon: "20 个交易日",
    summary: "短期估值偏高，注意风险控制。",
    createdAt: "昨天",
    key: "bearish",
  },
]);

const filteredViews = computed(() => {
  if (filter.value === "all") {
    return views.value;
  }
  return views.value.filter((item) => item.key === filter.value);
});
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
  justify-content: space-between;
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
  width: 32px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 16px;
  border: 1px solid var(--border);
  display: grid;
  gap: 8px;
}

.stock-header {
  display: inline-flex;
  gap: 8px;
  font-weight: 600;
}

.summary {
  font-size: 12px;
  color: var(--muted);
}

.tabs {
  margin-top: 12px;
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

.list {
  margin-top: 12px;
  display: grid;
  gap: 12px;
}

.item {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 12px;
  border: 1px solid var(--border);
  display: grid;
  gap: 8px;
}

.item-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.direction {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--ink);
}

.status {
  font-size: 12px;
  color: var(--muted);
}

.content {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.meta {
  font-size: 12px;
  color: var(--muted);
}
</style>
