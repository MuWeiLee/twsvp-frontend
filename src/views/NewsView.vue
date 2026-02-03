<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("挖掘") }}</div>
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

      <header class="tabs-wrap" :class="{ hidden: !showTabs }">
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
      </header>

      <div
        ref="scrollContainer"
        class="feed-scroll"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
      >
        <div class="refresh-indicator" :style="{ height: `${pullDistance}px` }">
          <span :class="{ active: pullDistance >= PULL_THRESHOLD }">{{ refreshLabel }}</span>
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
              <div class="card-code">{{ card.code }}</div>
            </div>

            <div class="card-performance">
              <div class="perf-item">
                <span class="perf-label">{{ t("昨日绩效") }}</span>
                <span class="perf-value">{{ formatPercent(card.prevDay) }}</span>
              </div>
              <div class="perf-item">
                <span class="perf-label">{{ t("今日绩效") }}</span>
                <span class="perf-value">{{ formatPercent(displayTodayValue(card)) }}</span>
              </div>
              <div class="perf-item">
                <span class="perf-label">{{ t("累计绩效") }}</span>
                <span class="perf-value">{{ formatPercent(card.cumulative) }}</span>
              </div>
            </div>

            <div class="dual-section">
              <div class="dual-title">{{ pickLeftLabel }}</div>
              <div class="dual-title">{{ pickLabel }}</div>
              <div class="dual-col">
                <div
                  v-for="holding in card.prevHoldings"
                  :key="holding.stock_id"
                  class="holding-mini"
                  role="button"
                  tabindex="0"
                  @click="goStock(holding.stock_id)"
                  @keydown.enter="goStock(holding.stock_id)"
                >
                  <div class="mini-row">
                    <div class="mini-name">{{ holding.name }}</div>
                    <div class="mini-value">{{ t("开") }}: {{ formatPrice(holding.open) }}</div>
                    <div class="mini-value">{{ t("仓位") }}: {{ formatPercent(holding.weight) }}</div>
                  </div>
                  <div class="mini-row">
                    <div class="mini-code">{{ holding.stock_id }}</div>
                    <div class="mini-value">{{ t("收") }}: {{ formatPrice(holding.close) }}</div>
                    <div class="mini-value" :class="perfClass(holding.perf)">
                      {{ t("绩效") }}: {{ formatPerf(holding.perf) }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="dual-col">
                <div
                  v-for="holding in card.todayHoldings"
                  :key="holding.stock_id"
                  class="holding-mini"
                  role="button"
                  tabindex="0"
                  @click="goStock(holding.stock_id)"
                  @keydown.enter="goStock(holding.stock_id)"
                >
                  <div class="mini-row">
                    <div class="mini-name">{{ holding.name }}</div>
                    <div class="mini-value">{{ t("开") }}: {{ formatPrice(holding.open) }}</div>
                    <div class="mini-value">{{ t("仓位") }}: {{ formatPercent(holding.weight) }}</div>
                  </div>
                  <div class="mini-row">
                    <div class="mini-code">{{ holding.stock_id }}</div>
                    <div class="mini-value">{{ t("收") }}: {{ formatPrice(holding.close) }}</div>
                    <div class="mini-value" :class="perfClass(holding.perf)">
                      {{ t("绩效") }}: {{ formatPerf(holding.perf) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <div v-if="!cards.length" class="empty">{{ t("暂无策略数据") }}</div>
        </section>
      </div>

      <BottomTabbar />
      <p class="legal">
        {{ t("任何觀點僅作為記錄與回溯，不作為預測價格與投資建議。") }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { fetchNewsSupabase } from "../services/news.js";
import { formatFeedTimestamp } from "../services/feeds.js";
import { t } from "../services/i18n.js";
import {
  STRATEGY_IDS,
  STRATEGY_LABELS,
  fetchLatestStrategyRuns,
  fetchStrategySignals,
  fetchStrategyVisibility,
  fetchStockNames,
  fetchStockPriceSnapshots,
} from "../services/strategy.js";

const activeTab = ref("news");
const showTabs = ref(true);
const lastScrollY = ref(0);
const router = useRouter();

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
const scrollContainer = ref(null);
const pullDistance = ref(0);
const touchStartY = ref(null);
let loadObserver = null;

const cards = ref([]);

const allowedStrategies = new Set(STRATEGY_IDS);

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

const goStock = (symbol) => {
  if (!symbol) return;
  router.push(`/stock/${symbol}`);
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
  if (loading.value || isRefreshing.value) return;
  if (!scrollContainer.value || scrollContainer.value.scrollTop > 0) return;
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
      if (entries[0]?.isIntersecting) {
        loadMore();
      }
    },
    { root: scrollContainer.value, rootMargin: "160px 0px" }
  );
  loadObserver.observe(loadTrigger.value);
};

const handleScroll = () => {
  const current = scrollContainer.value?.scrollTop || 0;
  if (current <= 4) {
    showTabs.value = true;
    lastScrollY.value = current;
    return;
  }
  const delta = current - lastScrollY.value;
  if (Math.abs(delta) < 6) return;
  showTabs.value = delta <= 0;
  lastScrollY.value = current;
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return "—";
  const percent = Number(value) * 100;
  return `${percent.toFixed(2)}%`;
};

const formatPrice = (value) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toFixed(2);
};

const formatPerf = (value) => {
  if (value === null || value === undefined) return "—";
  const percent = Number(value) * 100;
  return `${percent.toFixed(2)}%`;
};

const perfClass = (value) => {
  if (value === null || value === undefined) return "price-neutral";
  if (value > 0) return "price-up";
  if (value < 0) return "price-down";
  return "price-neutral";
};

const isAfterSwitch = computed(() => {
  const hour = new Date().getHours();
  return hour >= 22;
});

const pickLabel = computed(() => (isAfterSwitch.value ? t("明日选股") : t("今日选股")));
const pickLeftLabel = computed(() => (isAfterSwitch.value ? t("今日选股") : t("昨日选股")));

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = computed(() => getLocalDateKey());

const displayTodayValue = (card) => {
  if (!card?.latestTradeDate) return null;
  return card.latestTradeDate === todayKey.value ? card.today : null;
};

const loadStrategies = async () => {
  const runs = await fetchLatestStrategyRuns(60);
  if (!runs.length) {
    cards.value = [];
    return;
  }
  const visibility = await fetchStrategyVisibility(STRATEGY_IDS);
  const visibleSet = new Set(
    STRATEGY_IDS.filter((id) => visibility.get(id) === true)
  );
  const hasVisibility = visibility.size > 0;
  const allowedSet = new Set(
    [...allowedStrategies].filter((id) => (hasVisibility ? visibleSet.has(id) : true))
  );
  const weekEnds = [...new Set(runs.map((row) => row.week_end))].sort().reverse();
  const latestWeek = weekEnds[0];
  const prevWeek = weekEnds[1];

  const latestRuns = runs.filter(
    (row) => row.week_end === latestWeek && allowedSet.has(row.strategy_id)
  );
  const prevRuns = prevWeek
    ? runs.filter((row) => row.week_end === prevWeek && allowedSet.has(row.strategy_id))
    : [];

  const latestIds = latestRuns.map((row) => row.strategy_id);
  const prevIds = prevRuns.map((row) => row.strategy_id);

  const latestSignals = await fetchStrategySignals(latestWeek, latestIds);
  const prevSignals = prevWeek ? await fetchStrategySignals(prevWeek, prevIds) : [];

  const stockIds = [...new Set([...latestSignals, ...prevSignals].map((s) => s.stock_id))];
  const stockNames = await fetchStockNames(stockIds);
  const priceSnapshots = await fetchStockPriceSnapshots(stockIds);

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
    const latestHoldings = (latestByStrategy.get(run.strategy_id) || [])
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map((signal) => {
        const snapshot = priceSnapshots[signal.stock_id] || {};
        const latest = snapshot.latest;
        const isLatestToday = latest?.trade_date === todayKey.value;
        const todayPerf =
          isLatestToday && latest?.open && latest?.close
            ? (latest.close - latest.open) / latest.open
            : null;
        return {
          stock_id: signal.stock_id,
          name: stockNames[signal.stock_id] || t("股票名称"),
          weight: signal.target_weight,
          open: isLatestToday ? latest?.open ?? null : null,
          close: isLatestToday ? latest?.close ?? null : null,
          perf: todayPerf,
          latestTradeDate: latest?.trade_date || null,
        };
      });
    const latestTradeDate =
      latestHoldings
        .map((holding) => holding.latestTradeDate)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;
    const prevHoldings = (prevByStrategy.get(run.strategy_id) || [])
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map((signal) => {
        const snapshot = priceSnapshots[signal.stock_id] || {};
        const prev = snapshot.prev;
        const prevPerf =
          prev?.open && prev?.close ? (prev.close - prev.open) / prev.open : null;
        return {
          stock_id: signal.stock_id,
          name: stockNames[signal.stock_id] || t("股票名称"),
          weight: signal.target_weight,
          open: prev?.open ?? null,
          close: prev?.close ?? null,
          perf: prevPerf,
        };
      });
    const metrics = run.metrics || {};
    const label = metrics.label || STRATEGY_LABELS[run.strategy_id] || run.strategy_id;
    return {
      strategy_id: run.strategy_id,
      code: label,
      name: label,
      prevDay: metrics.prev_day_return ?? null,
      today: metrics.today_return ?? null,
      cumulative: metrics.cumulative_return ?? null,
      latestTradeDate,
      prevHoldings,
      todayHoldings: latestHoldings,
    };
  });
};

onMounted(async () => {
  await loadNews({ append: false });
  await loadStrategies();
  await nextTick();
  setupInfiniteScroll();
  if (scrollContainer.value) {
    lastScrollY.value = scrollContainer.value.scrollTop || 0;
    scrollContainer.value.addEventListener("scroll", handleScroll, { passive: true });
  }
});

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener("scroll", handleScroll);
  }
  if (loadObserver) loadObserver.disconnect();
});
</script>

<style scoped>
.app-shell {
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg);
  min-height: 100vh;
  height: 100vh;
  --nav-height: 64px;
  --tabs-height: 44px;
  --header-gap: 0px;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: calc(var(--nav-height) + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) 16px 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
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
  font-weight: 500;
  font-size: 20px;
  margin-right: auto;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  width: 32px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  text-decoration: none;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.tabs-wrap {
  position: fixed;
  top: calc(var(--nav-height) + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  z-index: 4;
  padding: 0 16px;
  transition: transform 0.2s ease;
}

.tabs-wrap.hidden {
  transform: translateY(-120%);
}

.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-top: 6px;
  align-items: center;
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

.feed-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: calc(var(--nav-height) + var(--tabs-height) + var(--header-gap) + env(safe-area-inset-top, 0px))
    16px
    calc(140px + env(safe-area-inset-bottom, 0px));
  overscroll-behavior: contain;
}

.refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  transition: height 0.2s ease;
}

.refresh-indicator span.active {
  color: var(--ink);
  font-weight: 600;
}

.load-trigger {
  display: flex;
  justify-content: center;
  padding: 12px 0 24px;
  font-size: 12px;
  color: var(--muted);
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.news-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 12px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.news-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.45;
}

.news-summary {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-meta {
  font-size: 12px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  font-size: 10px;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 12px;
}

.strategy-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 12px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

.card-code {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.card-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
}

.meta-label {
  font-size: 11px;
  color: var(--muted);
}

.meta-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  text-align: right;
}

.card-performance {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding-top: 4px;
}

.perf-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 0;
}

.perf-label {
  font-size: 11px;
  color: var(--muted);
}

.perf-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  text-align: right;
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
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 10px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 8px;
  align-items: center;
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

.mini-value {
  font-size: 11px;
  color: var(--muted);
  text-align: right;
}

.price-up {
  color: var(--price-up);
}

.price-down {
  color: var(--price-down);
}

.price-neutral {
  color: var(--muted);
}

.legal {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  width: min(600px, 100%);
  padding: 6px 16px;
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  text-align: left;
  background: var(--bg);
  z-index: 4;
}

.empty {
  text-align: center;
  color: var(--muted);
  padding: 24px 0 32px;
}
</style>
