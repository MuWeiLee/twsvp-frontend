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

      <section class="strategy-hero">
        <div class="hero-title">{{ t("量化策略") }}</div>
        <div class="hero-subtitle">
          {{ t("每周更新选股，每日计算本周与累计绩效") }}
        </div>
        <div class="hero-tags">
          <span class="tag">{{ t("回撤") }}</span>
          <span class="tag">{{ t("波动") }}</span>
          <span class="tag">{{ t("夏普") }}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">{{ t("策略ID表") }}</div>
        <div class="panel-subtitle">{{ t("资金方式 × 风险等级") }}</div>
        <div class="matrix">
          <div class="matrix-head">
            <div class="cell"></div>
            <div v-for="risk in riskStrategies" :key="risk.id" class="cell head">
              <div class="risk-name">{{ risk.name }}</div>
              <div class="risk-desc">{{ risk.desc }}</div>
            </div>
          </div>
          <div v-for="capital in capitalStrategies" :key="capital.id" class="matrix-row">
            <div class="cell row-head">
              <div class="capital-name">{{ capital.name }}</div>
              <div class="capital-desc">{{ capital.desc }}</div>
            </div>
            <div v-for="risk in riskStrategies" :key="risk.id" class="cell">
              <div class="strategy-id">{{ makeStrategyId(capital, risk) }}</div>
              <div class="strategy-meta">
                <span>{{ t("每周更新") }}</span>
                <span>·</span>
                <span>{{ t("每日绩效") }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">{{ t("本周绩效概览") }}</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">{{ t("平均回撤") }}</div>
            <div class="stat-value">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">{{ t("平均波动") }}</div>
            <div class="stat-value">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">{{ t("平均夏普") }}</div>
            <div class="stat-value">—</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">{{ t("最新策略信号") }}</div>
        <div class="signal-empty">{{ t("暂无信号，等待下一次周更新") }}</div>
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

const capitalStrategies = ref([
  { id: "fixed_5w", name: t("固定金额 5万"), desc: t("降低零股配置问题") },
  { id: "fixed_10w", name: t("固定金额 10万"), desc: t("中等资金规模") },
  { id: "fixed_50w", name: t("固定金额 50万"), desc: t("高资金配置") },
  { id: "dca_2k", name: t("定投 每周 2000"), desc: t("稳健累积") },
  { id: "dca_5k", name: t("定投 每周 5000"), desc: t("中等投入") },
  { id: "dca_10k", name: t("定投 每周 10000"), desc: t("加速累积") },
]);

const riskStrategies = ref([
  { id: "high_high", name: t("高收益高风险"), desc: t("高回撤") },
  { id: "high_mid", name: t("高收益中风险"), desc: t("中回撤") },
  { id: "mid_mid", name: t("中收益中风险"), desc: t("平衡") },
  { id: "mid_low", name: t("中收益低风险"), desc: t("低回撤") },
  { id: "low_low", name: t("低收益低风险"), desc: t("防守") },
]);

const makeStrategyId = (capital, risk) => `${capital.id}_${risk.id}`;
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

.strategy-hero {
  padding: 20px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.hero-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
}

.panel {
  background: var(--surface);
  margin: 12px 16px 0;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.matrix {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.matrix-head,
.matrix-row {
  display: grid;
  grid-template-columns: 130px repeat(5, minmax(120px, 1fr));
  gap: 8px;
}

.cell {
  background: rgba(148, 163, 184, 0.08);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cell.head {
  background: rgba(59, 130, 246, 0.08);
}

.row-head {
  background: rgba(15, 23, 42, 0.06);
}

.risk-name,
.capital-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.risk-desc,
.capital-desc {
  font-size: 11px;
  color: var(--muted);
}

.strategy-id {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}

.strategy-meta {
  font-size: 11px;
  color: var(--muted);
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.stats-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-card {
  background: rgba(15, 23, 42, 0.06);
  border-radius: 12px;
  padding: 12px;
}

.stat-label {
  font-size: 12px;
  color: var(--muted);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin-top: 6px;
}

.signal-empty {
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 600px) {
  .matrix-head,
  .matrix-row {
    grid-template-columns: 110px repeat(5, minmax(120px, 1fr));
    overflow-x: auto;
  }
}
</style>
