<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">概念观点</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="card">
        <div class="stock-header">
          <strong>{{ sector.name }}</strong>
          <span>{{ sector.type }}</span>
        </div>
        <div class="summary">近期讨论热度 {{ sector.mentions }} 次</div>
      </section>

      <section class="list">
        <div v-for="view in views" :key="view.id" class="item">
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
const sector = {
  name: "AI 供应链",
  type: "主题",
  mentions: 28,
};

const views = [
  {
    id: 1,
    direction: "看多",
    horizon: "10 个交易日",
    summary: "AI 需求持续扩张，短期订单能见度提升。",
    createdAt: "刚刚",
  },
  {
    id: 2,
    direction: "中性",
    horizon: "20 个交易日",
    summary: "题材热度仍在，但需关注估值拉升后的回调。",
    createdAt: "2 小时前",
  },
];
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
  padding: 72px 20px 40px;
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

.nav-space {
  width: 46px;
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
