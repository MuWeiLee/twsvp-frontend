<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <button class="nav-btn" type="button" :aria-label="t('返回')" @click="handleBack">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div class="nav-title">
          <span class="company-name">{{ stock.name || "—" }}</span>
          <span class="company-code">{{ stock.symbol }}</span>
        </div>
        <button class="nav-follow" type="button" @click="toggleStockFollow">
          {{ stockFollowLabel }}
        </button>
      </nav>

      <section class="chart-card">
        <div class="chart-header">
          <div class="chart-title">{{ t("日K行情") }}</div>
          <div class="chart-range">
            <div class="chart-range-buttons">
              <button
                v-for="option in chartRangeOptions"
                :key="option.value"
                class="chart-range-btn"
                :class="{ active: selectedRange === option.value }"
                type="button"
                @click="handleRangeChange(option.value)"
              >
                {{ t(option.label) }}
              </button>
            </div>
          </div>
        </div>
        <div
          class="chart-body"
          ref="chartBodyRef"
          :style="axisLayout"
          @click.self="clearActivePrice"
        >
          <template v-if="chartPrices.length">
            <div class="chart-axis y-axis left">
              <span
                v-for="label in axisLabels.price"
                :key="`price-${label.key}`"
                class="axis-label"
                :style="{ top: `${label.pos * 100}%` }"
              >
                {{ label.text }}
              </span>
            </div>
            <div class="chart-axis y-axis right">
              <span
                v-for="label in axisLabels.pct"
                :key="`pct-${label.key}`"
                class="axis-label"
                :style="{ top: `${label.pos * 100}%` }"
              >
                {{ label.text }}
              </span>
            </div>
            <div class="chart-plot" ref="chartPlotRef">
              <div class="chart-grid" aria-hidden="true"></div>
              <div class="candles" :style="candleLayout">
                <button
                  v-for="price in chartPrices"
                  :key="price.trade_date"
                  class="candle"
                  :class="[price.direction, { empty: price.empty }]"
                  type="button"
                  :disabled="price.empty"
                  @click="selectPrice(price, $event)"
                  :style="{
                    '--wick-top': price.wickTop,
                    '--wick-bottom': price.wickBottom,
                    '--body-top': price.bodyTop,
                    '--body-bottom': price.bodyBottom,
                  }"
                >
                  <span class="wick"></span>
                  <span class="body"></span>
                </button>
              </div>
            </div>
            <div class="x-axis" :style="candleLayout">
              <span class="x-axis-label" :style="{ left: `${axisLabels.timeStartPos}%` }">
                {{ axisLabels.timeStart }}
              </span>
              <span class="x-axis-label" :style="{ left: `${axisLabels.timeMidPos}%` }">
                {{ axisLabels.timeMid }}
              </span>
              <span class="x-axis-label" :style="{ left: `${axisLabels.timeEndPos}%` }">
                {{ axisLabels.timeEnd }}
              </span>
            </div>
            <div v-if="activePrice" class="hint-card chart-hint" :class="hintPlacement">
              <div class="hint-column">
                <div class="hint-date">{{ activePrice.dateLabel }}</div>
                <div class="hint-meta">
                  {{ t("观点数量：{count}条", { count: activePrice.feedCount }) }}
                </div>
                <div>{{ t("涨跌幅：{value}", { value: formatPercent(activePrice.changePct) }) }}</div>
                <div>{{ t("开盘价：{value}元", { value: formatPrice(activePrice.open) }) }}</div>
                <div>{{ t("收盘价：{value}元", { value: formatPrice(activePrice.close) }) }}</div>
                <div>{{ t("最高价：{value}元", { value: formatPrice(activePrice.high) }) }}</div>
                <div>{{ t("最低价：{value}元", { value: formatPrice(activePrice.low) }) }}</div>
                <div>{{ t("振幅：{value}", { value: formatPercent(activePrice.amplitude) }) }}</div>
              </div>
            </div>
          </template>
          <div v-else class="chart-empty">{{ t("暂无行情数据") }}</div>
        </div>
      </section>

      <div class="list-title list-title-spaced">{{ t("最新资讯") }}</div>
      <section v-if="newsItems.length" class="news-list">
        <article
          v-for="item in newsItems"
          :key="item.article_id"
          class="news-card"
          @click="openNews(item.link)"
        >
          <h3 class="news-title">{{ item.title || "—" }}</h3>
          <p v-if="item.description" class="news-summary">{{ item.description }}</p>
          <p v-else-if="item.content" class="news-summary">{{ item.content }}</p>
          <div class="news-meta">
            <span>{{ formatNewsTime(item.pub_date) }}</span>
            <span class="dot">·</span>
            <span>{{ formatNewsCreator(item.creator) }}</span>
          </div>
        </article>
      </section>
      <div v-else class="news-empty">{{ t("暂无资讯") }}</div>

      <div class="list-title list-title-spaced">{{ t("近 7 日观点统计") }}</div>
      <section class="sentiment-card">
        <div class="sentiment-row">
          <span>{{ t("看多") }} {{ sevenDayStats.longPct }}%</span>
          <span>{{ t("中性") }} {{ sevenDayStats.neutralPct }}%</span>
          <span>{{ t("看空") }} {{ sevenDayStats.shortPct }}%</span>
        </div>
        <div class="sentiment-bar" aria-hidden="true">
          <span class="segment long" :style="{ width: `${sevenDayStats.longPct}%` }"></span>
          <span
            class="segment neutral"
            :style="{ width: `${sevenDayStats.neutralPct}%` }"
          ></span>
          <span class="segment short" :style="{ width: `${sevenDayStats.shortPct}%` }"></span>
        </div>
      </section>

      <div class="list-title">{{ t("观点列表") }}</div>
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: filter === 'all' }"
          @click="filter = 'all'"
        >
          {{ t("全部") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'long' }"
          @click="filter = 'long'"
        >
          {{ t("看多") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'neutral' }"
          @click="filter = 'neutral'"
        >
          {{ t("中性") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'short' }"
          @click="filter = 'short'"
        >
          {{ t("看空") }}
        </button>
      </div>

      <section class="list">
        <div v-for="view in filteredViews" :key="view.feed_id" class="thread">
          <div class="thread-card" @click="goFeed(view.feed_id)">
            <div class="thread-header">
              <div class="header-left">
                <div class="stock" @click.stop="goStock(view.target_symbol)">
                  <span class="stock-name">{{ view.target_name }}</span>
                  <span class="stock-code">{{ view.target_symbol }}</span>
                </div>
                <span class="direction" :class="view.direction">
                  {{ view.directionLabel }}
                </span>
              </div>
              <div class="header-right">
                <span class="performance" :class="view.performanceDirection">
                  {{ t("绩效：{value}", { value: view.performanceLabel }) }}
                </span>
                <div class="more-wrap">
                  <button class="more-btn" type="button" @click.stop="toggleMenu(view.feed_id)">
                    ...
                  </button>
                  <div v-if="activeMenuId === view.feed_id" class="more-menu">
                    <template v-if="isAuthor(view)">
                      <button
                        v-if="canEditFeed(view)"
                        class="menu-item"
                        type="button"
                        @click.stop="handleEditFeed(view)"
                      >
                        {{ t("编辑观点") }}
                      </button>
                      <button
                        v-if="view.statusPhase !== 'ended'"
                        class="menu-item"
                        type="button"
                        @click.stop="handleEndFeed(view)"
                      >
                        {{ t("手动结束") }}
                      </button>
                      <button
                        class="menu-item danger"
                        type="button"
                        @click.stop="handleDeleteFeed(view)"
                      >
                        {{ t("删除观点") }}
                      </button>
                    </template>
                    <button
                      v-else
                      class="menu-item"
                      type="button"
                      @click.stop="handleHideFeed(view)"
                    >
                      {{ t("不看这条") }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="thread-meta">
              <div class="author" @click.stop="goProfile(view)">
                <span class="avatar" :class="{ empty: !view.authorAvatar }">
                  <img v-if="view.authorAvatar" :src="view.authorAvatar" alt="" />
                  <span v-else>{{ view.authorInitial }}</span>
                </span>
                <span class="author-name">{{ view.author }}</span>
              </div>
              <span class="status">{{ view.statusDisplay }}</span>
            </div>
            <div class="summary" @click.stop="goFeed(view.feed_id)">
              {{ view.summaryText }}
            </div>
            <div class="thread-footer">
              <span class="created-at">{{ view.createdLabel }}</span>
              <div class="thread-actions">
                <span class="reply-count" aria-label="留言数">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linejoin="round"
                    />
                  </svg>
                  {{ view.replyCount }}
                </span>
                <button
                  class="like-btn"
                  type="button"
                  :class="{ active: view.isLiked }"
                  @click.stop="toggleLike(view)"
                >
                  👍 {{ view.like_count }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!isLoading && !filteredViews.length" class="empty">
          {{ t("暂无观点") }}
        </div>
        <div v-if="hasMore" class="load-more">
          <button class="btn-secondary" type="button" :disabled="isLoadingMore" @click="loadMore">
            {{ isLoadingMore ? t("加载中...") : t("加载更多") }}
          </button>
        </div>
      </section>

      <div class="share-toast" :class="{ show: showShareToast }" role="status" aria-live="polite">
        {{ t("已复制个股链接") }}
      </div>
      <nav v-if="!isCreateOpen" class="stock-tabbar" aria-label="stock actions">
        <button class="tabbar-btn" type="button" @click="handleTrade">
          <span class="tabbar-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M8 16V8m0 0l-3 3m3-3l3 3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M16 8v8m0 0l-3-3m3 3l3-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="tabbar-label">{{ t("交易") }}</span>
        </button>
        <button class="tabbar-btn" type="button" @click="goCreateFeed">
          <span class="tabbar-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span class="tabbar-label">{{ t("发表观点") }}</span>
        </button>
        <button class="tabbar-btn" type="button" @click="handleShare">
          <span class="tabbar-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M7 17l10-10M10 7h7v7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="tabbar-label">{{ t("分享") }}</span>
        </button>
      </nav>
      <div v-if="isCreateOpen" class="create-feed-overlay">
        <div class="create-feed-frame">
          <CreateFeedPanel
            :initial-stock="createFeedStock"
            :bottom-offset="0"
            @close="closeCreateFeed"
            @published="handleCreatePublished"
          />
        </div>
      </div>
    </div>

    <FeedEditSheet
      :open="isEditOpen"
      :feed="editingFeed"
      :saving="isEditSaving"
      @close="closeEdit"
      @save="saveEdit"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CreateFeedPanel from "../components/CreateFeedPanel.vue";
import FeedEditSheet from "../components/FeedEditSheet.vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import {
  addFeedLikeSupabase,
  fetchFeedsBySymbolSupabase,
  fetchFeedLikesSupabase,
  formatFeedPercent,
  formatFeedTimestamp,
  getReplyCount,
  getElapsedDays,
  getRemainingDays,
  getStatusDisplay,
  getStatusLabel,
  getStatusPhase,
  mapDirectionToLabel,
  mapHorizonToLabel,
  removeFeedLikeSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";
import { supabase } from "../services/supabase.js";
import { fetchStockByIdSupabase, fetchStockPricesSupabase } from "../services/stocks.js";
import { t } from "../services/i18n.js";
import { applyShareMeta } from "../services/shareMeta.js";
import { fetchNewsSupabase } from "../services/news.js";
import {
  fetchBrokerPreferenceSupabase,
  getAppStoreDeepLink,
  getAppStoreUrl,
  getBrokerById,
  getBrokerPreferenceLocal,
} from "../services/brokers.js";
import { getFollowErrorMessage } from "../services/followErrors.js";

const route = useRoute();
const router = useRouter();
const filter = ref("all");
const stock = ref({
  symbol: "",
  name: "—",
  market: "",
  bullish: 0,
  bearish: 0,
  neutral: 0,
});
const views = ref([]);
const feedRows = ref([]);
const priceSeries = ref([]);
const isLoading = ref(false);
const currentUserId = ref("");
const likedIds = ref(new Set());
const isCreateOpen = ref(false);
const hiddenIds = ref(new Set());
const activeMenuId = ref(null);
const selectedPrice = ref(null);
const hintPlacement = ref("bottom-right");
const chartBodyRef = ref(null);
const chartPlotRef = ref(null);
const chartPlotWidth = ref(0);
const newsItems = ref([]);
const isEditOpen = ref(false);
const isEditSaving = ref(false);
const editingFeed = ref(null);
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const isStockFollowed = ref(false);
const PAGE_SIZE = 20;
const FOLLOW_STOCKS_KEY = "twsvp_followed_stocks";
const chartRangeOptions = [
  { value: 20, label: "20日" },
  { value: 50, label: "50日" },
  { value: 100, label: "100日" },
];
const selectedRange = ref(20);
const activeSymbol = ref("");
const brokerId = ref("");
const showShareToast = ref(false);
let shareToastTimer;

const stockFollowLabel = computed(() => (isStockFollowed.value ? t("已关注") : t("+关注")));

const readFollowedStocks = () => {
  try {
    const raw = localStorage.getItem(FOLLOW_STOCKS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set((list || []).filter(Boolean));
  } catch (error) {
    return new Set();
  }
};

const saveFollowedStocks = (set) => {
  localStorage.setItem(FOLLOW_STOCKS_KEY, JSON.stringify([...set]));
};

const syncStockFollowState = (symbol) => {
  const list = readFollowedStocks();
  isStockFollowed.value = symbol ? list.has(symbol) : false;
};

const toggleStockFollow = async () => {
  const symbol = activeSymbol.value;
  if (!symbol) return;
  const supabaseUser = await getCurrentUserSupabase({ force: true, ensureSession: true });
  currentUserId.value = supabaseUser?.id || "";
  if (!currentUserId.value) {
    window.alert(t("请重新登录后再关注"));
    router.push("/login");
    return;
  }
  const list = readFollowedStocks();
  const next = !list.has(symbol);
  if (next) {
    const { error } = await supabase
      .from("user_stock_follows")
      .upsert(
        { user_id: currentUserId.value, stock_symbol: symbol },
        { onConflict: "user_id,stock_symbol" }
      );
    if (error) {
      console.error("关注股票失败:", error);
      window.alert(getFollowErrorMessage(error, { action: "follow" }));
      return;
    }
    list.add(symbol);
  } else {
    const { error } = await supabase
      .from("user_stock_follows")
      .delete()
      .eq("user_id", currentUserId.value)
      .eq("stock_symbol", symbol);
    if (error) {
      console.error("取消关注股票失败:", error);
      window.alert(getFollowErrorMessage(error, { action: "unfollow" }));
      return;
    }
    list.delete(symbol);
  }
  saveFollowedStocks(list);
  isStockFollowed.value = next;
};
let chartResizeObserver;

const selectedBroker = computed(() => getBrokerById(brokerId.value));
const createFeedStock = computed(() => {
  if (!stock.value.symbol) return null;
  return {
    stock_id: stock.value.symbol,
    name: stock.value.name,
    market: stock.value.market,
  };
});

const formatDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatHintDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};


const formatPrice = (value) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toFixed(2);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
};

const formatNewsTime = (value) => formatFeedTimestamp(value);

const formatNewsCreator = (creator) => {
  if (!creator) return "—";
  if (Array.isArray(creator)) return creator.filter(Boolean).join(" ");
  return `${creator}`;
};

const updateChartPlotWidth = () => {
  const rect = chartPlotRef.value?.getBoundingClientRect();
  chartPlotWidth.value = rect ? Math.floor(rect.width) : 0;
};

const selectPrice = (price, event) => {
  if (!price || price.empty) return;
  selectedPrice.value = price;
  const rect = chartBodyRef.value?.getBoundingClientRect();
  if (!rect || !event) return;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const horizontal = x < rect.width / 2 ? "right" : "left";
  const vertical = y < rect.height / 2 ? "bottom" : "top";
  hintPlacement.value = `${vertical}-${horizontal}`;
};

const handleRangeChange = (value) => {
  selectedRange.value = value;
  selectedPrice.value = null;
};

const clearActivePrice = () => {
  selectedPrice.value = null;
};

const loadHiddenIds = () => {
  try {
    const raw = localStorage.getItem("twsvp_feed_hidden");
    const ids = raw ? JSON.parse(raw) : [];
    hiddenIds.value = new Set(ids);
  } catch (error) {
    hiddenIds.value = new Set();
  }
};

const saveHiddenIds = () => {
  localStorage.setItem("twsvp_feed_hidden", JSON.stringify([...hiddenIds.value]));
};

const isAuthor = (view) => currentUserId.value && view.user_id === currentUserId.value;

const canEditFeed = (view) => {
  if (!currentUserId.value || view.user_id !== currentUserId.value) {
    return false;
  }
  const createdAt = new Date(view.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 10 * 60 * 1000;
};

const toggleMenu = (feedId) => {
  activeMenuId.value = activeMenuId.value === feedId ? null : feedId;
};

const closeMenu = () => {
  activeMenuId.value = null;
};

const handleHideFeed = (view) => {
  hiddenIds.value.add(view.feed_id);
  saveHiddenIds();
  closeMenu();
};

const feedCountByDate = computed(() => {
  const counts = {};
  feedRows.value.forEach((feed) => {
    const key = formatDateKey(feed.created_at);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
});

const sortedSeries = computed(() => {
  if (!priceSeries.value.length) return [];
  return [...priceSeries.value].sort((a, b) => {
    const timeA = new Date(a.trade_date).getTime();
    const timeB = new Date(b.trade_date).getTime();
    return timeA - timeB;
  });
});

const parseDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatDateOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : parseDateOnly(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
};

const tradingDays = computed(() => {
  const list = sortedSeries.value;
  if (!list.length) return [];
  const unique = [];
  let lastDate = "";
  list.forEach((item) => {
    const date = formatDateOnly(item.trade_date);
    if (!date || date === lastDate) return;
    unique.push(date);
    lastDate = date;
  });
  const count = Math.max(1, Number(selectedRange.value) || 1);
  const queryDate = typeof route.query.date === "string" ? route.query.date.trim() : "";
  const anchor = formatDateOnly(queryDate);
  const anchorIndex = anchor ? unique.indexOf(anchor) : unique.length - 1;
  const endIndex = anchorIndex >= 0 ? anchorIndex : unique.length - 1;
  const startIndex = Math.max(0, endIndex - count + 1);
  return unique.slice(startIndex, endIndex + 1);
});

const chartTimeline = computed(() => {
  return tradingDays.value;
});

const displaySeries = computed(() => {
  const timeline = chartTimeline.value;
  if (!timeline.length) return [];
  const dataMap = new Map(
    sortedSeries.value
      .filter((item) => item.trade_date)
      .map((item) => [formatDateOnly(item.trade_date), item])
  );
  return timeline.map((trade_date, index) => {
    const item = dataMap.get(formatDateOnly(trade_date));
    if (!item) {
      return {
        trade_date: formatDateOnly(trade_date),
        seriesIndex: index,
        empty: true,
      };
    }
    return {
      ...item,
      trade_date: formatDateOnly(trade_date),
      seriesIndex: index,
      empty: false,
    };
  });
});

const dataSeries = computed(() => displaySeries.value.filter((item) => !item.empty));

const createMeasureContext = () => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d");
};

const measureAxisWidth = (labels, fontSize, fallback) => {
  if (!labels?.length) return fallback;
  const context = createMeasureContext();
  if (!context) return fallback;
  const fontFamily =
    chartBodyRef.value && typeof window !== "undefined"
      ? window.getComputedStyle(chartBodyRef.value).fontFamily || "system-ui"
      : "system-ui";
  context.font = `${fontSize}px ${fontFamily}`;
  let maxWidth = 0;
  labels.forEach((label) => {
    const text = label?.text ?? "";
    if (!text) return;
    const width = context.measureText(text).width || 0;
    if (width > maxWidth) maxWidth = width;
  });
  const padding = 14;
  const raw = Math.ceil(maxWidth + padding);
  const min = 48;
  const max = 96;
  return Math.max(min, Math.min(max, raw));
};

const roundUpToStep = (value, step) => {
  const rounded = Math.ceil(value / step) * step;
  return rounded > value ? rounded : rounded + step;
};
const roundDownToStep = (value, step) => Math.floor(value / step) * step;

const getNiceStep = (range, reference = 1) => {
  if (!Number.isFinite(range) || range <= 0) {
    if (reference >= 100) return 5;
    if (reference >= 10) return 1;
    if (reference >= 1) return 0.5;
    if (reference >= 0.1) return 0.05;
    return 0.005;
  }
  const rough = range / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const baseSteps = [0.05, 0.1, 0.5, 1, 2.5, 5, 10];
  let step = baseSteps[baseSteps.length - 1] * magnitude;
  for (const base of baseSteps) {
    if (base >= normalized) {
      step = base * magnitude;
      break;
    }
  }
  return Math.max(step, 0.005);
};

const getPriceDecimals = (step) => {
  if (step < 0.1) return 3;
  if (step < 1) return 2;
  return 2;
};

const chartRange = computed(() => {
  if (!dataSeries.value.length) {
    return {
      min: 0,
      max: 0,
      range: 1,
      rawHigh: 0,
      rawLow: 0,
      latest: 0,
      baseOpen: 1,
      step: 1,
    };
  }
  const baseItem = dataSeries.value[0] || {};
  const baseOpen = Number(baseItem.open ?? baseItem.close ?? 0) || 1;
  const highs = dataSeries.value.map((item) =>
    Number(item.high ?? item.close ?? item.open ?? 0)
  );
  const lows = dataSeries.value.map((item) =>
    Number(item.low ?? item.close ?? item.open ?? 0)
  );
  const rawHigh = Math.max(...highs);
  const rawLow = Math.min(...lows);
  const priceRange = rawHigh - rawLow || 1;
  const pctHigh = baseOpen ? (rawHigh - baseOpen) / baseOpen : 0;
  const pctLow = baseOpen ? (rawLow - baseOpen) / baseOpen : 0;
  const paddedHigh = baseOpen ? baseOpen * (1 + pctHigh + 0.05) : rawHigh;
  const paddedLow = baseOpen ? baseOpen * (1 + pctLow - 0.05) : rawLow;
  const targetHigh = Math.max(rawHigh, paddedHigh);
  const targetLow = Math.min(rawLow, paddedLow);
  const step = getNiceStep(targetHigh - targetLow, rawHigh || rawLow || 1);
  let max = roundUpToStep(targetHigh, step);
  let min = roundDownToStep(targetLow, step);
  if (max <= targetHigh) max += step;
  if (min >= targetLow) min -= step;
  if (max - min < step * 4) {
    max = min + step * 4;
  }
  const range = max - min || 1;
  const latestItem = dataSeries.value[dataSeries.value.length - 1] || {};
  const latest = Number(latestItem.close ?? latestItem.open ?? 0);
  return { min, max, range, rawHigh, rawLow, latest, baseOpen, step };
});

const chartPrices = computed(() => {
  const list = displaySeries.value;
  if (!list.length) return [];
  const { max, range } = chartRange.value;
  return list.map((item) => {
    if (item.empty) {
      return {
        ...item,
        open: null,
        close: null,
        high: null,
        low: null,
        direction: "empty",
        wickTop: 1,
        wickBottom: 1,
        bodyTop: 1,
        bodyBottom: 1,
        dateLabel: formatHintDate(item.trade_date),
        feedCount: 0,
        changePct: null,
        amplitude: null,
      };
    }
    const open = Number(item.open ?? item.close ?? 0);
    const close = Number(item.close ?? item.open ?? 0);
    const high = Number(item.high ?? Math.max(open, close));
    const low = Number(item.low ?? Math.min(open, close));
    const direction = close >= open ? "up" : "down";
    const wickTop = (max - high) / range;
    const wickBottom = (max - low) / range;
    const bodyTop = (max - Math.max(open, close)) / range;
    const bodyBottom = (max - Math.min(open, close)) / range;
    const dateKey = formatDateKey(item.trade_date);
    const feedCount = feedCountByDate.value[dateKey] || 0;
    const changePct = open ? ((close - open) / open) * 100 : 0;
    const amplitude = open ? ((high - low) / open) * 100 : 0;
    return {
      ...item,
      open,
      close,
      high,
      low,
      direction,
      wickTop,
      wickBottom,
      bodyTop,
      bodyBottom,
      dateLabel: formatHintDate(item.trade_date),
      feedCount,
      changePct,
      amplitude,
    };
  });
});


const axisLabels = computed(() => {
  if (!chartTimeline.value.length) {
    return {
      price: [],
      pct: [],
      timeStart: "—",
      timeMid: "—",
      timeEnd: "—",
      timeStartPos: 0,
      timeMidPos: 50,
      timeEndPos: 100,
    };
  }
  const { min, max, range, baseOpen, step } = chartRange.value;
  const decimals = getPriceDecimals(step);
  const ticks = Array.from({ length: 5 }, (_, idx) => min + step * idx);
  const priceLabels = ticks.map((value, index) => ({
    key: `${value.toFixed(4)}-${index}`,
    pos: range ? (max - value) / range : 0,
    text: value.toFixed(decimals),
  }));
  const pctLabels = ticks.map((value, index) => ({
    key: `${value.toFixed(4)}-${index}`,
    pos: range ? (max - value) / range : 0,
    text: formatPercent(((value - baseOpen) / baseOpen) * 100),
  }));
  const lastIndex = chartTimeline.value.length - 1;
  const midIndex = Math.floor(lastIndex / 2);
  const formatAxisDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${month}-${day}`;
  };
  const timeStart = formatAxisDate(chartTimeline.value[0]);
  const timeMid = formatAxisDate(chartTimeline.value[midIndex]);
  const timeEnd = formatAxisDate(chartTimeline.value[lastIndex]);
  const count = chartTimeline.value.length;
  const calcPos = (index) => {
    if (!count) return 0;
    return ((index + 0.5) / count) * 100;
  };
  return {
    price: priceLabels,
    pct: pctLabels,
    timeStart,
    timeMid,
    timeEnd,
    timeStartPos: calcPos(0),
    timeMidPos: calcPos(midIndex),
    timeEndPos: calcPos(lastIndex),
  };
});

const activePrice = computed(() => {
  return selectedPrice.value;
});

const axisLayout = computed(() => {
  const left = measureAxisWidth(axisLabels.value.price, 11, 56);
  const right = measureAxisWidth(axisLabels.value.pct, 11, 60);
  return {
    "--axis-left-width": `${left}px`,
    "--axis-right-width": `${right}px`,
  };
});

const candleLayout = computed(() => {
  const count = chartPrices.value.length;
  const width = chartPlotWidth.value;
  if (!count || !width) {
    return {};
  }
  const slot = width / count;
  const widthRatio = count >= 100 ? 0.8 : count >= 50 ? 0.74 : 0.66;
  let gap = count > 1 ? slot * (1 - widthRatio) : 0;
  const gapMax = Math.min(8, slot * 0.6);
  gap = Math.min(Math.max(gap, 0), gapMax);
  let candleWidth = slot - gap;
  if (slot <= 3) {
    gap = 0;
    candleWidth = slot;
  }
  const pad = gap / 2;
  const contentWidth = count * candleWidth + Math.max(0, count - 1) * gap;
  const offset = Math.max(0, width - pad * 2 - contentWidth);
  return {
    "--candle-gap": `${gap}px`,
    "--candle-width": `${candleWidth}px`,
    "--candle-pad": `${pad}px`,
    "--candle-half": `${candleWidth / 2}px`,
    "--candle-offset": `${offset}px`,
  };
});

const buildViews = (list) =>
  list.map((view) => {
    const phase = getStatusPhase(view);
    const author = view.users?.nickname || t("用户");
    const performancePct = view.performance_pct ?? null;
    const performanceDirection =
      performancePct > 0 ? "up" : performancePct < 0 ? "down" : "neutral";
    const performanceLabel = formatFeedPercent(performancePct);
    return {
      ...view,
      statusPhase: phase,
      statusLabel: getStatusLabel(phase),
      statusDisplay: getStatusDisplay(view, phase),
      directionLabel: mapDirectionToLabel(view.direction),
      horizonLabel: mapHorizonToLabel(view.horizon),
      createdLabel: formatFeedTimestamp(view.created_at),
      remainingDays: getRemainingDays(view),
      author,
      authorAvatar: view.users?.avatar_url || "",
      authorInitial: author ? author.trim().slice(0, 1) : "",
      summaryText: view.content || view.summary || "",
      isLiked: likedIds.value.has(view.feed_id),
      replyCount: getReplyCount(view),
      performancePct,
      performanceDirection,
      performanceLabel,
    };
  });

const sevenDayStats = computed(() => {
  const counts = { long: 0, neutral: 0, short: 0 };
  feedRows.value.forEach((feed) => {
    if (getElapsedDays(feed.created_at) > 7) return;
    if (feed.direction === "long") counts.long += 1;
    else if (feed.direction === "short") counts.short += 1;
    else counts.neutral += 1;
  });
  const total = counts.long + counts.neutral + counts.short || 1;
  return {
    longPct: ((counts.long / total) * 100).toFixed(1),
    neutralPct: ((counts.neutral / total) * 100).toFixed(1),
    shortPct: ((counts.short / total) * 100).toFixed(1),
  };
});

const filteredViews = computed(() => {
  let list = views.value.filter((view) => !hiddenIds.value.has(view.feed_id));
  if (filter.value !== "all") {
    list = list.filter((item) => item.direction === filter.value);
  }
  return list;
});

const loadFeeds = async ({ append = false } = {}) => {
  if (!activeSymbol.value) return;
  const feeds = await fetchFeedsBySymbolSupabase(activeSymbol.value, {
    page: page.value,
    pageSize: PAGE_SIZE,
  });
  const nextViews = buildViews(feeds);
  if (append) {
    feedRows.value = [...feedRows.value, ...feeds];
    views.value = [...views.value, ...nextViews];
  } else {
    feedRows.value = feeds;
    views.value = nextViews;
  }
  hasMore.value = feeds.length === PAGE_SIZE;
  await loadLikedIds(views.value);
};

const loadNews = async () => {
  try {
    newsItems.value = await fetchNewsSupabase(3);
  } catch (error) {
    console.error("Load news failed:", error);
    newsItems.value = [];
  }
};

const loadData = async () => {
  const symbolParam = route.params.symbol;
  if (!symbolParam || Array.isArray(symbolParam)) {
    return;
  }
  const symbol = String(symbolParam);
  activeSymbol.value = symbol;
  syncStockFollowState(symbol);
  isLoading.value = true;
  const [stockInfo, prices] = await Promise.all([
    fetchStockByIdSupabase(symbol),
    fetchStockPricesSupabase(symbol),
  ]);
  await loadNews();
  priceSeries.value = prices;
  selectedPrice.value = null;
  await loadFeeds();
  const counts = views.value.reduce(
    (acc, view) => {
      if (view.direction === "long") acc.bullish += 1;
      else if (view.direction === "short") acc.bearish += 1;
      else acc.neutral += 1;
      return acc;
    },
    { bullish: 0, bearish: 0, neutral: 0 }
  );
  stock.value = {
    symbol,
    name: stockInfo?.name || symbol,
    market: stockInfo?.market || "",
    ...counts,
  };
  applyShareMeta({ name: stock.value.name, url: window.location.href });
  isLoading.value = false;
  activeMenuId.value = null;
};

const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value) return;
  isLoadingMore.value = true;
  page.value += 1;
  await loadFeeds({ append: true });
  isLoadingMore.value = false;
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase({ force: true });
  currentUserId.value = supabaseUser?.id || "";
  brokerId.value = await fetchBrokerPreferenceSupabase(currentUserId.value);
  await loadLikedIds();
};

const goFeed = (feedId) => {
  if (!feedId) return;
  router.push(`/feed/${feedId}`);
};

const goStock = (symbol) => {
  if (!symbol) return;
  router.push(`/stock/${symbol}`);
};

const goProfile = (view) => {
  const userId = view?.user_id;
  if (!userId) return;
  if (currentUserId.value && userId === currentUserId.value) {
    router.push("/profile");
  } else {
    router.push(`/user/${userId}`);
  }
};

const openNews = (link) => {
  if (!link) return;
  window.open(link, "_blank", "noopener");
};

const goCreateFeed = () => {
  isCreateOpen.value = true;
};

const closeCreateFeed = () => {
  isCreateOpen.value = false;
};

const handleCreatePublished = async () => {
  isCreateOpen.value = false;
  page.value = 1;
  hasMore.value = true;
  await loadData();
};

const handleDeleteFeed = async (view) => {
  const confirmed = window.confirm(t("确定删除这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  views.value = views.value.filter((item) => item.feed_id !== view.feed_id);
  closeMenu();
};

const handleEndFeed = async (view) => {
  const confirmed = window.confirm(t("确定结束这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ status: "expired", expires_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  await loadData();
  closeMenu();
};

const handleEditFeed = async (view) => {
  editingFeed.value = { ...view };
  isEditOpen.value = true;
  closeMenu();
};

const closeEdit = () => {
  isEditOpen.value = false;
  editingFeed.value = null;
};

const saveEdit = async (content) => {
  if (!editingFeed.value) return;
  const nextContent = content.trim();
  if (!nextContent) return;
  isEditSaving.value = true;
  await supabase
    .from("feeds")
    .update({ content: nextContent })
    .eq("feed_id", editingFeed.value.feed_id);
  await loadData();
  isEditSaving.value = false;
  closeEdit();
};

const loadLikedIds = async (list = views.value) => {
  if (!currentUserId.value || !list.length) {
    likedIds.value = new Set();
    return;
  }
  const feedIds = list.map((view) => view.feed_id);
  likedIds.value = await fetchFeedLikesSupabase(currentUserId.value, feedIds);
  views.value = views.value.map((view) => ({
    ...view,
    isLiked: likedIds.value.has(view.feed_id),
  }));
};

const toggleLike = async (view) => {
  if (!currentUserId.value) {
    router.replace("/login");
    return;
  }
  const alreadyLiked = likedIds.value.has(view.feed_id);
  const delta = alreadyLiked ? -1 : 1;
  const nextCount = Math.max(0, (view.like_count || 0) + delta);
  view.like_count = nextCount;
  view.isLiked = !alreadyLiked;
  const feedIndex = views.value.findIndex((item) => item.feed_id === view.feed_id);
  if (feedIndex !== -1) {
    views.value[feedIndex] = {
      ...views.value[feedIndex],
      like_count: nextCount,
      isLiked: !alreadyLiked,
    };
  }
  const nextIds = new Set(likedIds.value);
  if (alreadyLiked) {
    nextIds.delete(view.feed_id);
  } else {
    nextIds.add(view.feed_id);
  }
  likedIds.value = nextIds;
  const ok = alreadyLiked
    ? await removeFeedLikeSupabase(currentUserId.value, view.feed_id)
    : await addFeedLikeSupabase(currentUserId.value, view.feed_id);
  if (ok) {
    await updateFeedLikeCountSupabase(view.feed_id, delta);
  } else {
    const revertCount = Math.max(0, (view.like_count || 0) - delta);
    view.like_count = revertCount;
    view.isLiked = alreadyLiked;
    if (feedIndex !== -1) {
      views.value[feedIndex] = {
        ...views.value[feedIndex],
        like_count: revertCount,
        isLiked: alreadyLiked,
      };
    }
    await loadLikedIds();
  }
};

const handleBack = () => {
  router.back();
};

const handleTrade = () => {
  if (!brokerId.value) {
    brokerId.value = getBrokerPreferenceLocal();
  }
  const broker = getBrokerById(brokerId.value);
  if (!broker) {
    window.alert(t("请前往个人中心 > 设置 > 选择交易券商，完成跳转设置。"));
    return;
  }
  const appStoreUrl = getAppStoreUrl(broker);
  const appScheme = broker.appScheme || "";
  if (!appScheme) {
    const appStoreDeepLink = getAppStoreDeepLink(broker);
    if (!appStoreDeepLink && appStoreUrl) {
      window.location.href = appStoreUrl;
      return;
    }
    if (!appStoreDeepLink) return;
    const fallbackTimer = window.setTimeout(() => {
      if (appStoreUrl) {
        window.location.href = appStoreUrl;
      }
    }, 800);
    const clearFallback = () => window.clearTimeout(fallbackTimer);
    window.addEventListener("pagehide", clearFallback, { once: true });
    window.addEventListener("blur", clearFallback, { once: true });
    window.location.href = appStoreDeepLink;
    return;
  }
  const fallbackTimer = window.setTimeout(() => {
    if (appStoreUrl) {
      window.location.href = appStoreUrl;
    }
  }, 1200);
  const clearFallback = () => window.clearTimeout(fallbackTimer);
  window.addEventListener("pagehide", clearFallback, { once: true });
  window.addEventListener("blur", clearFallback, { once: true });
  window.location.href = appScheme;
};

const showShareToastMessage = () => {
  showShareToast.value = true;
  if (shareToastTimer) window.clearTimeout(shareToastTimer);
  shareToastTimer = window.setTimeout(() => {
    showShareToast.value = false;
  }, 1800);
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
};

const handleShare = async () => {
  const url = window.location.href;
  const ok = await copyText(url);
  if (ok) {
    showShareToastMessage();
  }
};

onMounted(loadUser);
onMounted(loadHiddenIds);
onMounted(loadData);
onMounted(() => {
  updateChartPlotWidth();
  if (typeof ResizeObserver !== "undefined") {
    chartResizeObserver = new ResizeObserver(updateChartPlotWidth);
    if (chartPlotRef.value) {
      chartResizeObserver.observe(chartPlotRef.value);
    }
  }
  window.addEventListener("resize", updateChartPlotWidth);
});
onBeforeUnmount(() => {
  if (shareToastTimer) window.clearTimeout(shareToastTimer);
  if (chartResizeObserver) {
    chartResizeObserver.disconnect();
  }
  window.removeEventListener("resize", updateChartPlotWidth);
  document.body.style.overflow = "";
});
watch([filter], () => {
  window.scrollTo({ top: 0, behavior: "auto" });
});
watch(() => route.params.symbol, async () => {
  page.value = 1;
  hasMore.value = true;
  await loadData();
});
watch(isCreateOpen, (value) => {
  document.body.style.overflow = value ? "hidden" : "";
});
</script>

<style scoped>
.app-shell {
  max-width: 600px;
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
  --stock-tabbar-height: 64px;
  padding: 76px 16px calc(var(--stock-tabbar-height) + 20px);
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
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

.nav-title {
  font-weight: 500;
  font-size: 20px;
  margin-right: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  width: 32px;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.nav-follow {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--ink);
}

.company-name {
  font-weight: 600;
}

.company-code {
  font-size: 12px;
  color: var(--muted);
}

.chart-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 16px;
  border: 1px solid var(--border);
  display: grid;
  gap: 12px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.chart-title {
  font-weight: 600;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.chart-range {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.chart-range-buttons {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  justify-content: flex-end;
  white-space: nowrap;
}

.chart-range-btn {
  border: 0;
  background: transparent;
  padding: 0 0 4px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.chart-range-btn.active {
  color: var(--ink);
  border-color: var(--ink);
}

.hint-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--ink);
  display: grid;
  gap: 8px;
}

.hint-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.hint-column {
  display: grid;
  gap: 6px;
  font-weight: 500;
}

.hint-date {
  font-size: 12px;
  font-weight: 600;
}

.hint-meta {
  color: var(--muted);
  font-weight: 500;
}

.hint-grid {
  display: none;
}

.chart-body {
  height: 220px;
  position: relative;
  --axis-left-width: 56px;
  --axis-right-width: 60px;
  overflow: visible;
}

.chart-plot {
  position: absolute;
  inset: 12px var(--axis-right-width) 26px var(--axis-left-width);
  overflow: hidden;
}

.chart-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px);
  background-size: 20% 100%, 100% 25%;
  z-index: 0;
}

.candles {
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
  gap: var(--candle-gap, 6px);
  height: 100%;
  width: 100%;
  position: relative;
  z-index: 2;
  padding: 0 var(--candle-pad, 0px);
  padding-left: calc(var(--candle-pad, 0px) + var(--candle-offset, 0px));
  box-sizing: border-box;
}

.candle {
  flex: 0 0 var(--candle-width, 6px);
  width: var(--candle-width, 6px);
  position: relative;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.candle.empty {
  cursor: default;
}

.candle.empty .wick,
.candle.empty .body {
  opacity: 0;
}

.candle .wick {
  position: absolute;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  top: calc(var(--wick-top) * 100%);
  height: calc((var(--wick-bottom) - var(--wick-top)) * 100%);
  background: currentColor;
}

.candle .body {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--body-top) * 100%);
  height: calc((var(--body-bottom) - var(--body-top)) * 100%);
  min-height: 2px;
  background: currentColor;
  border-radius: 2px;
}

.candle.up {
  color: var(--price-up);
}

.candle.down {
  color: var(--price-down);
}

.chart-axis {
  position: absolute;
  top: 12px;
  bottom: 26px;
  display: block;
  pointer-events: none;
  font-size: 11px;
  color: var(--muted);
  z-index: 1;
}

.axis-label {
  position: absolute;
  transform: translateY(-50%);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  padding: 0 2px;
  background: var(--surface);
}

.chart-axis.left {
  left: 0;
  text-align: left;
  width: var(--axis-left-width);
}

.chart-axis.right {
  right: 0;
  text-align: right;
  width: var(--axis-right-width);
}

.chart-axis.left .axis-label {
  left: 0;
}

.chart-axis.right .axis-label {
  right: 0;
}

.x-axis {
  position: absolute;
  left: var(--axis-left-width);
  right: var(--axis-right-width);
  bottom: 4px;
  height: 16px;
  font-size: 10px;
  color: var(--muted);
  z-index: 2;
  display: block;
  padding: 0 var(--candle-pad, 0px);
  padding-left: calc(var(--candle-pad, 0px) + var(--candle-offset, 0px));
  box-sizing: border-box;
  overflow: visible;
}

.x-axis-label {
  text-align: center;
  white-space: nowrap;
  position: absolute;
  transform: translateX(-50%);
  font-variant-numeric: tabular-nums;
  max-width: 96px;
}

@media (max-width: 420px) {
  .chart-axis {
    font-size: 10px;
  }
}

.chart-hint {
  position: absolute;
  max-width: 220px;
  z-index: 3;
}

.chart-hint.top-left {
  top: 8px;
  left: 8px;
}

.chart-hint.top-right {
  top: 8px;
  right: 8px;
}

.chart-hint.bottom-left {
  bottom: 8px;
  left: 8px;
}

.chart-hint.bottom-right {
  bottom: 8px;
  right: 8px;
}

.chart-empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 12px;
}

.news-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.news-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--ink);
}

.news-summary {
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
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

.news-meta .dot {
  font-size: 12px;
}

.news-empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  padding: 6px 0 4px;
}

.sentiment-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  border: 1px solid var(--border);
  display: grid;
  gap: 10px;
}

.sentiment-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
}

.sentiment-bar {
  height: 8px;
  background: var(--panel);
  border-radius: 999px;
  overflow: hidden;
  display: flex;
}

.segment {
  height: 100%;
}

.segment.long {
  background: var(--price-up);
}

.segment.neutral {
  background: var(--border);
}

.segment.short {
  background: var(--price-down);
}

.list-title {
  margin-top: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.list-title-spaced {
  margin-top: 20px;
  margin-bottom: 10px;
}

.tabs {
  margin-top: 10px;
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

.thread-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 12px;
  border: 1px solid var(--border);
  display: grid;
  gap: 8px;
  cursor: pointer;
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.more-wrap {
  position: relative;
}

.more-btn {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 16px;
  cursor: pointer;
  color: var(--muted);
}

.more-menu {
  position: absolute;
  right: 0;
  top: 18px;
  min-width: 120px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  display: grid;
  z-index: 4;
  overflow: hidden;
}

.menu-item {
  border: 0;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  font-size: 12px;
  cursor: pointer;
  color: var(--ink);
}

.menu-item + .menu-item {
  border-top: 1px solid var(--border);
}

.menu-item.danger {
  color: var(--negative);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  flex-wrap: wrap;
}

.header-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.stock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.stock-name {
  font-size: 14px;
  font-weight: 600;
}

.stock-code {
  font-size: 12px;
  color: var(--muted);
}

.performance {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.performance.up {
  color: var(--price-up);
}

.performance.down {
  color: var(--price-down);
}

.performance.neutral {
  color: var(--muted);
}

.direction {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--ink);
}

.direction.long {
  color: var(--price-up);
  border-color: var(--price-up);
}

.direction.short {
  color: var(--price-down);
  border-color: var(--price-down);
}

.direction.neutral {
  color: var(--muted);
  border-color: var(--border);
}

.thread-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.author {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: var(--panel);
  color: var(--ink);
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.status {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.summary {
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.thread-footer {
  display: flex;
  align-items: center;
}

.thread-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.reply-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.reply-count svg {
  width: 16px;
  height: 16px;
}

.created-at {
  font-size: 12px;
  color: var(--muted);
}

.like-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--ink);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.like-btn.active {
  border-color: var(--ink);
  background: var(--surface);
}

.empty {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: var(--muted);
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0 24px;
}

.btn-secondary {
  border-radius: 999px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
  cursor: pointer;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.share-toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--stock-tabbar-height) + 14px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--ink);
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 7;
}

.share-toast.show {
  opacity: 1;
}

.create-feed-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 8;
  display: flex;
  justify-content: center;
}

.create-feed-frame {
  width: 100%;
  max-width: 600px;
  min-height: 100vh;
  padding: 76px 16px 120px;
  background: var(--bg);
}

.stock-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  height: var(--stock-tabbar-height);
  padding: 6px 12px calc(6px + env(safe-area-inset-bottom, 0px));
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  z-index: 6;
}

.tabbar-btn {
  border: 0;
  background: transparent;
  display: grid;
  justify-items: center;
  gap: 4px;
  color: var(--ink);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
}

.tabbar-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tabbar-icon svg {
  width: 22px;
  height: 22px;
}

.tabbar-label {
  font-size: 12px;
  font-weight: 600;
}
</style>
