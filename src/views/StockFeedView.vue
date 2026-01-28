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
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="chart-card">
        <div class="chart-header">
          <div class="chart-title">{{ t("日K 行情") }}</div>
        </div>
        <div class="chart-body" ref="chartBodyRef" @click.self="clearActivePrice">
          <template v-if="chartPrices.length">
            <div class="chart-axis y-axis left">
              <span v-for="label in axisLabels.price" :key="label">{{ label }}</span>
            </div>
            <div class="chart-axis y-axis right">
              <span v-for="label in axisLabels.pct" :key="label">{{ label }}</span>
            </div>
            <div class="chart-plot">
              <div class="chart-grid" aria-hidden="true"></div>
              <div class="candles">
                <button
                  v-for="price in chartPrices"
                  :key="price.trade_date"
                  class="candle"
                  :class="price.direction"
                  type="button"
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
            <div class="x-axis">
              <span>{{ axisLabels.timeStart }}</span>
              <span>{{ axisLabels.timeMid }}</span>
              <span>{{ axisLabels.timeEnd }}</span>
            </div>
            <div v-if="activePrice" class="hint-card chart-hint" :class="hintPlacement">
              <div class="hint-row">
                <span class="hint-date">{{ activePrice.dateLabel }}</span>
                <span class="hint-meta">
                  {{ t("观点数量：{count} 条", { count: activePrice.feedCount }) }}
                </span>
              </div>
              <div class="hint-grid">
                <div>
                  {{ t("收盘价：{value}元", { value: formatPrice(activePrice.close) }) }}
                </div>
                <div>
                  {{ t("涨跌幅：{value}", { value: formatPercent(activePrice.changePct) }) }}
                </div>
                <div>
                  {{ t("开盘价：{value}元", { value: formatPrice(activePrice.open) }) }}
                </div>
                <div>{{ t("振幅") }}：{{ formatPercent(activePrice.amplitude) }}</div>
                <div>
                  {{ t("最高：{value}元", { value: formatPrice(activePrice.high) }) }}
                </div>
                <div>
                  {{ t("最低：{value}元", { value: formatPrice(activePrice.low) }) }}
                </div>
              </div>
            </div>
          </template>
          <div v-else class="chart-empty">{{ t("暂无行情数据") }}</div>
        </div>
      </section>

      <section class="sentiment-card">
        <div class="sentiment-title">{{ t("近 7 日观点统计") }}</div>
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
          :class="{ active: filter === 'short' }"
          @click="filter = 'short'"
        >
          {{ t("看空") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'neutral' }"
          @click="filter = 'neutral'"
        >
          {{ t("中性") }}
        </button>
      </div>

      <div class="status-tabs">
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          {{ t("全部") }}
        </button>
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'active' }"
          @click="statusFilter = 'active'"
        >
          {{ t("进行中") }}
        </button>
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'ended' }"
          @click="statusFilter = 'ended'"
        >
          {{ t("已结束") }}
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
                  <button v-else class="menu-item" type="button" @click.stop="handleHideFeed(view)">
                    {{ t("不看这条") }}
                  </button>
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
import {
  fetchBrokerPreferenceSupabase,
  getAppStoreDeepLink,
  getAppStoreUrl,
  getBrokerById,
  getBrokerPreferenceLocal,
} from "../services/brokers.js";

const route = useRoute();
const router = useRouter();
const filter = ref("all");
const statusFilter = ref("all");
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
const isEditOpen = ref(false);
const isEditSaving = ref(false);
const editingFeed = ref(null);
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const PAGE_SIZE = 20;
const MAX_CANDLES = 30;
const PRICE_FETCH_SIZE = 60;
const activeSymbol = ref("");
const brokerId = ref("");
const showShareToast = ref(false);
let shareToastTimer;

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
  return `${year}/${month}/${day}`;
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

const selectPrice = (price, event) => {
  selectedPrice.value = price;
  const rect = chartBodyRef.value?.getBoundingClientRect();
  if (!rect || !event) return;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const horizontal = x < rect.width / 2 ? "right" : "left";
  const vertical = y < rect.height / 2 ? "bottom" : "top";
  hintPlacement.value = `${vertical}-${horizontal}`;
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

const getCloseValue = (item) => Number(item.close ?? item.open ?? 0);

const displaySeries = computed(() => {
  const list = priceSeries.value.slice();
  if (!list.length) return [];
  const start = Math.max(0, list.length - MAX_CANDLES);
  return list.slice(start).map((item, index) => ({
    ...item,
    seriesIndex: start + index,
  }));
});

const chartRange = computed(() => {
  if (!displaySeries.value.length) {
    return { min: 0, max: 0, range: 1 };
  }
  const highs = displaySeries.value.map((item) =>
    Number(item.high ?? item.close ?? item.open ?? 0)
  );
  const lows = displaySeries.value.map((item) =>
    Number(item.low ?? item.close ?? item.open ?? 0)
  );
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  return { min, max, range: max - min || 1 };
});


const chartPrices = computed(() => {
  const list = displaySeries.value;
  if (!list.length) return [];
  const { max, range } = chartRange.value;
  return list.map((item) => {
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
  if (!displaySeries.value.length) {
    return { price: [], pct: [], timeStart: "—", timeMid: "—", timeEnd: "—" };
  }
  const { min, max } = chartRange.value;
  const mid = (min + max) / 2;
  const base = getCloseValue(displaySeries.value[0]) || 1;
  const priceLabels = [max, mid, min].map((value) => formatPrice(value));
  const pctLabels = [max, mid, min].map((value) => {
    const pct = ((value - base) / base) * 100;
    return formatPercent(pct);
  });
  const lastIndex = displaySeries.value.length - 1;
  const midIndex = Math.floor(lastIndex / 2);
  const timeStart = formatHintDate(displaySeries.value[0].trade_date);
  const timeMid = formatHintDate(displaySeries.value[midIndex].trade_date);
  const timeEnd = formatHintDate(displaySeries.value[lastIndex].trade_date);
  return { price: priceLabels, pct: pctLabels, timeStart, timeMid, timeEnd };
});

const activePrice = computed(() => {
  return selectedPrice.value;
});

const buildViews = (list) =>
  list.map((view) => {
    const phase = getStatusPhase(view);
    const author = view.users?.nickname || t("用户");
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
  if (statusFilter.value !== "all") {
    list = list.filter((item) => item.statusPhase === statusFilter.value);
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

const loadData = async () => {
  const symbolParam = route.params.symbol;
  if (!symbolParam || Array.isArray(symbolParam)) {
    return;
  }
  const symbol = String(symbolParam);
  activeSymbol.value = symbol;
  isLoading.value = true;
  const [stockInfo, prices] = await Promise.all([
    fetchStockByIdSupabase(symbol),
    fetchStockPricesSupabase(symbol, PRICE_FETCH_SIZE),
  ]);
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
  const supabaseUser = await getCurrentUserSupabase();
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
  if (route.query.from === "search") {
    const q = typeof route.query.q === "string" ? route.query.q : "";
    const tab = typeof route.query.tab === "string" ? route.query.tab : "all";
    router.push({ path: "/search", query: q ? { q, tab } : { tab } });
    return;
  }
  router.push("/feed");
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
onBeforeUnmount(() => {
  if (shareToastTimer) window.clearTimeout(shareToastTimer);
  document.body.style.overflow = "";
});
watch([filter, statusFilter], () => {
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

.nav-space {
  margin-left: auto;
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
  align-items: flex-start;
}

.chart-title {
  font-weight: 600;
  font-size: 14px;
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

.hint-date {
  font-size: 12px;
}

.hint-meta {
  color: var(--muted);
  font-weight: 500;
}

.hint-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  color: var(--muted);
}

.chart-body {
  height: 220px;
  position: relative;
}

.chart-plot {
  position: absolute;
  inset: 12px 34px 26px;
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
  align-items: stretch;
  gap: 6px;
  height: 100%;
  position: relative;
  z-index: 2;
}

.candle {
  flex: 1 1 0;
  min-width: 6px;
  position: relative;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
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
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  z-index: 1;
}

.chart-axis.left {
  left: 6px;
  text-align: left;
}

.chart-axis.right {
  right: 6px;
  text-align: right;
}

.x-axis {
  position: absolute;
  left: 34px;
  right: 34px;
  bottom: 4px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  z-index: 2;
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

.sentiment-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  border: 1px solid var(--border);
  display: grid;
  gap: 10px;
}

.sentiment-title {
  font-size: 13px;
  font-weight: 600;
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

.status-tabs {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.status-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
}

.status-btn.active {
  border-color: var(--ink);
  color: var(--ink);
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
