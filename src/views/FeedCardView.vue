<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">观点详情</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="card">
        <div class="header">
          <div class="stock">
            <strong>{{ feed.symbol }}</strong>
            <span>{{ feed.name }}</span>
          </div>
          <span class="status">{{ feed.status }}</span>
        </div>
        <div class="meta">
          <span class="direction">{{ feed.direction }}</span>
          <span>{{ feed.horizon }}</span>
          <span>作者 {{ feed.author }}</span>
        </div>
        <p class="content">{{ feed.content }}</p>
        <div class="footer">
          <span>发布时间 {{ feed.createdAt }}</span>
          <span>互动 {{ feed.likes }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
const feed = {
  symbol: "2330",
  name: "台积电",
  direction: "看多",
  horizon: "10 个交易日",
  author: "林可心",
  status: "未结束",
  createdAt: "2024/11/06",
  likes: 18,
  content:
    "法说会后动能持续，关注外资回补与量能变化。观点到期前不做加码，偏趋势跟随策略。",
};
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
  padding: 18px;
  border: 1px solid var(--border);
  display: grid;
  gap: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
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

.meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.direction {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--ink);
}

.content {
  margin: 0;
  line-height: 1.6;
  color: var(--ink);
}

.footer {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  justify-content: space-between;
}
</style>
