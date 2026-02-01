<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("量化") }}</div>
        <router-link class="nav-btn" to="/search" :aria-label="t('搜索')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
            <path
              d="M20 20l-4-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </router-link>
        <router-link class="nav-btn" to="/notifications" :aria-label="t('通知')">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 4c-3 0-5 2.2-5 5.2v3.2l-1.6 2.4c-.4.6 0 1.2.7 1.2h11.8c.7 0 1.1-.6.7-1.2L17 12.4V9.2C17 6.2 15 4 12 4z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
            <path
              d="M10 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
          </svg>
        </router-link>
      </nav>

      <section class="hero">
        <div class="hero-title">{{ t("量化策略") }}</div>
        <div class="hero-subtitle">
          {{ t("每周更新选股，每日计算本周与累计绩效") }}
        </div>
      </section>

      <section class="card-list">
        <article v-for="card in strategyCards" :key="card.code" class="strategy-card">
          <div class="card-header">
            <div class="card-title">{{ card.name }}</div>
            <div class="card-badges">
              <span class="badge">{{ card.code }}</span>
            </div>
          </div>

          <div class="card-meta">
            <div class="meta-item">
              <span class="meta-label">{{ t("资金方式") }}</span>
              <span class="meta-value">{{ card.capital }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ t("风险收益") }}</span>
              <span class="meta-value">{{ card.risk }}</span>
            </div>
          </div>

          <div class="card-performance">
            <div class="perf-item">
              <span class="perf-label">{{ t("最新单日") }}</span>
              <span class="perf-value">00%</span>
            </div>
            <div class="perf-item">
              <span class="perf-label">{{ t("累计绩效") }}</span>
              <span class="perf-value">00%</span>
            </div>
          </div>

          <div class="card-section-title">{{ t("仓位配置") }}</div>
          <div class="holdings">
            <div v-for="(holding, idx) in card.holdings" :key="`${card.code}-${idx}`" class="holding-row">
              <div class="holding-left">
                <div class="holding-name">{{ holding.name }}</div>
                <div class="holding-code">{{ holding.code }}</div>
              </div>
              <div class="holding-right">
                <div class="holding-price">{{ holding.price }}</div>
                <div class="holding-shares">{{ holding.shares }}</div>
                <div class="holding-weight">{{ holding.weight }}</div>
              </div>
            </div>
          </div>

          <div class="card-footnote">
            <div class="footnote-title">{{ t("策略指标（内部记录）") }}</div>
            <div class="footnote-content">
              {{ t("回撤 / 波动 / 夏普 / 年化收益 / 胜率") }}
            </div>
          </div>
        </article>
      </section>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { t } from "../services/i18n.js";

const strategyCards = ref([
  {
    code: "S-A01",
    name: t("固定金额 · 高收益高风险"),
    capital: t("固定金额 5万"),
    risk: t("高收益高风险（高回撤）"),
    holdings: [
      { name: t("股票名称"), code: "2330", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2317", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2454", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2308", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2382", price: "—", shares: "—", weight: "—" },
    ],
  },
  {
    code: "S-B02",
    name: t("固定金额 · 中收益低风险"),
    capital: t("固定金额 10万"),
    risk: t("中收益低风险（低回撤）"),
    holdings: [
      { name: t("股票名称"), code: "1101", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "1216", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "1301", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2303", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2412", price: "—", shares: "—", weight: "—" },
    ],
  },
  {
    code: "S-C03",
    name: t("定投 · 中收益中风险"),
    capital: t("定投 每周 5000"),
    risk: t("中收益中风险（平衡）"),
    holdings: [
      { name: t("股票名称"), code: "2881", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2882", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2884", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2885", price: "—", shares: "—", weight: "—" },
      { name: t("股票名称"), code: "2891", price: "—", shares: "—", weight: "—" },
    ],
  },
]);
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  justify-content: center;
  padding: 16px 0 24px;
}

.phone-frame {
  width: min(100%, 520px);
  background: var(--bg);
  border-radius: 28px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  border: 1px solid var(--border);
  overflow: hidden;
}

.nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 2;
}

.nav-logo {
  width: 28px;
  height: 28px;
  border-radius: 0;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  text-decoration: none;
  padding: 0;
  cursor: pointer;
}

.nav-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nav-title {
  font-size: 18px;
  font-weight: 600;
  margin-right: auto;
  text-align: left;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.hero {
  padding: 20px 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
}

.hero-subtitle {
  font-size: 14px;
  color: var(--muted);
}

.card-list {
  padding: 8px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.strategy-card {
  background: var(--surface);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
}

.card-badges {
  display: flex;
  gap: 8px;
}

.badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  font-weight: 600;
}

.card-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  background: rgba(148, 163, 184, 0.08);
  border-radius: 12px;
  padding: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 11px;
  color: var(--muted);
}

.meta-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.card-performance {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.perf-item {
  background: rgba(15, 23, 42, 0.06);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.perf-label {
  font-size: 11px;
  color: var(--muted);
}

.perf-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}

.card-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.holdings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.holding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(148, 163, 184, 0.08);
}

.holding-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.holding-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.holding-code {
  font-size: 11px;
  color: var(--muted);
}

.holding-right {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--ink);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.holding-price,
.holding-shares,
.holding-weight {
  min-width: 54px;
  text-align: right;
}

.card-footnote {
  background: rgba(59, 130, 246, 0.08);
  border-radius: 12px;
  padding: 12px;
  font-size: 12px;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.footnote-title {
  font-weight: 600;
  color: var(--ink);
}
</style>
