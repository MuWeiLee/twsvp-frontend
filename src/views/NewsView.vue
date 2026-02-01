<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("资讯") }}</div>
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

      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'news' }"
          @click="activeTab = 'news'"
        >
          {{ t("资讯") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'strategy' }"
          @click="activeTab = 'strategy'"
        >
          {{ t("策略") }}
        </button>
      </div>

      <section v-if="activeTab === 'news'" class="news-list">
        <article
          v-for="item in items"
          :key="item.article_id"
          class="news-card"
          @click="openLink(item.link)"
        >
          <h3 class="news-title">{{ item.title || "—" }}</h3>
          <p v-if="item.description" class="news-summary">{{ item.description }}</p>
          <p v-else-if="item.content" class="news-summary">{{ item.content }}</p>
          <div class="news-meta">
            <span>{{ formatTime(item.pub_date) }}</span>
            <span class="dot">·</span>
            <span>{{ formatCreator(item.creator) }}</span>
          </div>
        </article>
        <div v-if="!loading && !items.length" class="empty">
          {{ t("暂无资讯") }}
        </div>
        <div ref="loadTrigger" class="load-trigger">
          <span v-if="loading || isLoadingMore || isRefreshing">{{ t("加载中...") }}</span>
          <span v-else-if="hasMore">{{ t("下滑加载更多") }}</span>
          <span v-else>{{ t("已加载全部") }}</span>
        </div>
      </section>

      <section v-else class="card-list">
        <article v-for="card in cards" :key="card.strategy_id" class="strategy-card">
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
              <span class="perf-label">{{ t("前日绩效") }}</span>
              <span class="perf-value">{{ formatPercent(card.prevDay) }}</span>
            </div>
            <div class="perf-item">
              <span class="perf-label">{{ t("今日绩效") }}</span>
              <span class="perf-value">{{ formatPercent(card.today) }}</span>
            </div>
            <div class="perf-item">
              <span class="perf-label">{{ t("累计绩效") }}</span>
              <span class="perf-value">{{ formatPercent(card.cumulative) }}</span>
            </div>
          </div>

          <div class="dual-section">
            <div class="dual-title">{{ t("前日仓位") }}</div>
            <div class="dual-title">{{ t("今日仓位") }}</div>
            <div class="dual-col">
              <div
                v-for="holding in card.prevHoldings"
                :key="holding.stock_id"
                class="holding-mini"
              >
                <div class="mini-top">
                  <div class="mini-name">{{ holding.name }}</div>
                  <div class="mini-open">{{ t("开盘") }} · —</div>
                  <div class="mini-weight">{{ t("仓位") }} · {{ formatPercent(holding.weight) }}</div>
                </div>
                <div class="mini-bottom">
                  <div class="mini-code">{{ holding.stock_id }}</div>
                  <div class="mini-close">{{ t("收盘") }} · —</div>
                  <div class="mini-perf">{{ t("绩效") }} · —</div>
                </div>
              </div>
            </div>
            <div class="dual-col">
              <div
                v-for="holding in card.todayHoldings"
                :key="holding.stock_id"
                class="holding-mini"
              >
                <div class="mini-top">
                  <div class="mini-name">{{ holding.name }}</div>
                  <div class="mini-open">{{ t("开盘") }} · —</div>
                  <div class="mini-weight">{{ t("仓位") }} · {{ formatPercent(holding.weight) }}</div>
                </div>
                <div class="mini-bottom">
                  <div class="mini-code">{{ holding.stock_id }}</div>
                  <div class="mini-close">{{ t("收盘") }} · —</div>
                  <div class="mini-perf">{{ t("绩效") }} · —</div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div v-if="!cards.length" class="empty">{{ t("暂无策略数据") }}</div>
      </section>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { fetchNewsSupabase } from "../services/news.js";
import { formatFeedTimestamp } from "../services/feeds.js";
import { t } from "../services/i18n.js";
import { fetchLatestStrategyRuns, fetchStrategySignals, fetchStockNames } from "../services/strategy.js";

const activeTab = ref("news");

const PAGE_SIZE = 20;
const PULL_THRESHOLD = 60;
const PULL_MAX = 90;

const items = ref([]);
const loading = ref(false);
const isLoadingMore = ref(false);
const isRefreshing = ref(false);
const hasMore = ref(true);
const page = ref(1);
const loadTrigger = ref(null);
const pullDistance = ref(0);
const touchStartY = ref(null);
let loadObserver = null;

const cards = ref([]);

const capitalLabels = {
  fixed_5w: t("固定金额 5万"),
  fixed_20w: t("固定金额 20万"),
  fixed_50w: t("固定金额 50万"),
  dca_2k: t("定投 每周 2000"),
  dca_5k: t("定投 每周 5000"),
  dca_10k: t("定投 每周 10000"),
};

const riskLabels = {
  high_high: t("高收益高风险（高回撤）"),
  high_mid: t("高收益中风险（中回撤）"),
  mid_mid: t("中收益中风险（平衡）"),
  mid_low: t("中收益低风险（低回撤）"),
  low_low: t("低收益低风险（防守）"),
};

const refreshLabel = computed(() => {
  if (isRefreshing.value) return t("刷新中...");
  if (pullDistance.value >= PULL_THRESHOLD) return t("松开刷新");
  return t("下拉刷新");
});

const formatCreator = (creator) => {
  if (!creator) return "—";
  if (Array.isArray(creator)) return creator.filter(Boolean).join(" ");
  return `${creator}`;
};

const formatTime = (value) => formatFeedTimestamp(value);

const openLink = (link) => {
  if (!link) return;
  window.open(link, "_blank", "noopener");
};

const loadNews = async ({ append = false } = {}) => {
  if (append) {
    isLoadingMore.value = true;
  } else {
    loading.value = true;
  }
  try {
    const rows = await fetchNewsSupabase({ page: page.value, pageSize: PAGE_SIZE });
    items.value = append ? [...items.value, ...rows] : rows;
    hasMore.value = rows.length === PAGE_SIZE;
  } catch (error) {
    console.error("Load news failed:", error);
  } finally {
    if (append) {
      isLoadingMore.value = false;
    } else {
      loading.value = false;
    }
  }
};

const refreshNews = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  page.value = 1;
  hasMore.value = true;
  await loadNews({ append: false });
  isRefreshing.value = false;
};

const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value || loading.value) return;
  page.value += 1;
  await loadNews({ append: true });
};

const handleTouchStart = (event) => {
  if (window.scrollY > 0 || loading.value || isRefreshing.value) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  touchStartY.value = touch.clientY;
};

const handleTouchMove = (event) => {
  if (touchStartY.value === null) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  const delta = touch.clientY - touchStartY.value;
  if (delta <= 0) return;
  event.preventDefault();
  pullDistance.value = Math.min(PULL_MAX, delta);
};

const handleTouchEnd = async () => {
  if (touchStartY.value === null) return;
  if (pullDistance.value >= PULL_THRESHOLD) {
    await refreshNews();
  }
  pullDistance.value = 0;
  touchStartY.value = null;
};

const setupInfiniteScroll = () => {
  if (!loadTrigger.value) return;
  if (loadObserver) {
    loadObserver.disconnect();
  }
  loadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      });
    },
    { threshold: 0.1 }
  );
  loadObserver.observe(loadTrigger.value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return "00%";
  const percent = Number(value) * 100;
  return `${percent.toFixed(2)}%`;
};

const parseStrategyId = (id = "") => {
  const parts = id.split("_");
  if (parts.length < 3) return { capital: "", risk: "" };
  const capital = parts.slice(0, 2).join("_");
  const risk = parts.slice(2).join("_");
  return { capital, risk };
};

const loadStrategies = async () => {
  const runs = await fetchLatestStrategyRuns(60);
  if (!runs.length) {
    cards.value = [];
    return;
  }
  const weekEnds = [...new Set(runs.map((row) => row.week_end))].sort().reverse();
  const latestWeek = weekEnds[0];
  const prevWeek = weekEnds[1];

  const latestRuns = runs.filter((row) => row.week_end === latestWeek);
  const prevRuns = prevWeek ? runs.filter((row) => row.week_end === prevWeek) : [];

  const latestIds = latestRuns.map((row) => row.strategy_id);
  const prevIds = prevRuns.map((row) => row.strategy_id);

  const latestSignals = await fetchStrategySignals(latestWeek, latestIds);
  const prevSignals = prevWeek ? await fetchStrategySignals(prevWeek, prevIds) : [];

  const stockIds = [...new Set([...latestSignals, ...prevSignals].map((s) => s.stock_id))];
  const stockNames = await fetchStockNames(stockIds);

  const latestByStrategy = new Map();
  latestSignals.forEach((signal) => {
    if (!latestByStrategy.has(signal.strategy_id)) {
      latestByStrategy.set(signal.strategy_id, []);
    }
    latestByStrategy.get(signal.strategy_id).push(signal);
  });

  const prevByStrategy = new Map();
  prevSignals.forEach((signal) => {
    if (!prevByStrategy.has(signal.strategy_id)) {
      prevByStrategy.set(signal.strategy_id, []);
    }
    prevByStrategy.get(signal.strategy_id).push(signal);
  });

  cards.value = latestRuns.map((run, index) => {
    const { capital, risk } = parseStrategyId(run.strategy_id);
    const latestHoldings = (latestByStrategy.get(run.strategy_id) || []).map((signal) => ({
      stock_id: signal.stock_id,
      name: stockNames[signal.stock_id] || t("股票名称"),
      weight: signal.target_weight,
    }));
    const prevHoldings = (prevByStrategy.get(run.strategy_id) || []).map((signal) => ({
      stock_id: signal.stock_id,
      name: stockNames[signal.stock_id] || t("股票名称"),
      weight: signal.target_weight,
    }));
    const metrics = run.metrics || {};
    return {
      strategy_id: run.strategy_id,
      code: `S-${String(index + 1).padStart(2, "0")}`,
      name: `${capitalLabels[capital] || capital} · ${riskLabels[risk] || risk}`,
      capital: capitalLabels[capital] || capital,
      risk: riskLabels[risk] || risk,
      prevDay: metrics.prev_day_return ?? null,
      today: metrics.today_return ?? null,
      cumulative: metrics.cumulative_return ?? null,
      prevHoldings,
      todayHoldings: latestHoldings,
    };
  });
};

onMounted(async () => {
  await loadNews({ append: false });
  await nextTick();
  setupInfiniteScroll();
  await loadStrategies();
});

onUnmounted(() => {
  if (loadObserver) loadObserver.disconnect();
});
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

.tabs {
  display: flex;
  gap: 12px;
  padding: 12px 16px 0;
}

.tab-btn {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  background: transparent;
  border: none;
  padding: 8px 4px;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: var(--ink);
  border-bottom-color: var(--ink);
}

.news-list {
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.news-card {
  background: var(--surface);
  border-radius: 0;
  padding: 16px;
  border: 1px solid var(--border);
  cursor: pointer;
}

.news-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 8px;
  line-height: 1.45;
}

.news-summary {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 12px;
}

.news-meta {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  font-size: 10px;
}

.load-trigger {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  padding-bottom: 16px;
}

.hero {
  padding: 16px 16px 4px;
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
  border-radius: 0;
  padding: 16px;
  border: 1px solid var(--border);
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
  border-radius: 0;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.perf-item {
  background: rgba(15, 23, 42, 0.06);
  border-radius: 0;
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

.dual-section {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dual-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.dual-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.holding-mini {
  background: rgba(148, 163, 184, 0.08);
  border-radius: 0;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-top,
.mini-bottom {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.mini-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.mini-code {
  font-size: 11px;
  color: var(--muted);
}

.mini-open,
.mini-close,
.mini-weight,
.mini-perf {
  font-size: 11px;
  color: var(--muted);
}

.card-footnote {
  background: rgba(59, 130, 246, 0.08);
  border-radius: 0;
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

.empty {
  text-align: center;
  color: var(--muted);
  padding: 24px 0 32px;
}
</style>
