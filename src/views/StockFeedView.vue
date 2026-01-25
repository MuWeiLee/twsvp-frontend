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
          <span v-if="stock.market" class="market">{{ stock.market }}</span>
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
          :class="{ active: filter === 'long' }"
          @click="filter = 'long'"
        >
          看多
        </button>
        <button
          class="tab-btn"
          :class="{ active: filter === 'short' }"
          @click="filter = 'short'"
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

      <div class="status-tabs">
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          全部
        </button>
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'pending' }"
          @click="statusFilter = 'pending'"
        >
          未结束
        </button>
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'active' }"
          @click="statusFilter = 'active'"
        >
          进行中
        </button>
        <button
          class="status-btn"
          :class="{ active: statusFilter === 'ended' }"
          @click="statusFilter = 'ended'"
        >
          已结束
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
            <div class="thread-summary" @click.stop="goStock(view.target_symbol)">
              {{ view.summaryText }}
            </div>
            <div class="thread-footer">
              <span class="created-at">{{ view.createdLabel }}</span>
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
        <div v-if="!isLoading && !filteredViews.length" class="empty">
          暂无观点
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import {
  addFeedLikeSupabase,
  fetchFeedsBySymbolSupabase,
  fetchFeedLikesSupabase,
  getRemainingDays,
  getStatusDisplay,
  getStatusLabel,
  getStatusPhase,
  mapDirectionToLabel,
  mapHorizonToLabel,
  removeFeedLikeSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";
import { fetchStockByIdSupabase } from "../services/stocks.js";

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
const isLoading = ref(false);
const currentUserId = ref("");
const likedIds = ref(new Set());

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const buildViews = (list) =>
  list.map((view) => {
    const phase = getStatusPhase(view);
    const author = view.users?.nickname || "用户";
    return {
      ...view,
      statusPhase: phase,
      statusLabel: getStatusLabel(phase),
      statusDisplay: getStatusDisplay(view, phase),
      directionLabel: mapDirectionToLabel(view.direction),
      horizonLabel: mapHorizonToLabel(view.horizon),
      createdLabel: formatDate(view.created_at),
      remainingDays: getRemainingDays(view),
      author,
      authorAvatar: view.users?.avatar_url || "",
      authorInitial: author ? author.trim().slice(0, 1) : "",
      summaryText: view.summary || view.content || "",
      isLiked: likedIds.value.has(view.feed_id),
    };
  });

const filteredViews = computed(() => {
  let list = views.value;
  if (filter.value !== "all") {
    list = list.filter((item) => item.direction === filter.value);
  }
  if (statusFilter.value !== "all") {
    list = list.filter((item) => item.statusPhase === statusFilter.value);
  }
  return list;
});

const loadData = async () => {
  const symbolParam = route.params.symbol;
  if (!symbolParam || Array.isArray(symbolParam)) {
    return;
  }
  const symbol = String(symbolParam);
  isLoading.value = true;
  const [stockInfo, feeds] = await Promise.all([
    fetchStockByIdSupabase(symbol),
    fetchFeedsBySymbolSupabase(symbol),
  ]);
  const nextViews = buildViews(feeds);
  const counts = nextViews.reduce(
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
  views.value = nextViews;
  await loadLikedIds(nextViews);
  isLoading.value = false;
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";
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

onMounted(loadUser);
onMounted(loadData);
watch(() => route.params.symbol, loadData);
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
  flex-wrap: wrap;
}

.summary {
  font-size: 12px;
  color: var(--muted);
}

.market {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
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
  display: inline-flex;
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
  font-weight: 600;
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
}

.thread-summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.thread-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
</style>
