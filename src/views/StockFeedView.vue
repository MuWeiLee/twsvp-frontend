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
        <div
          v-for="view in filteredViews"
          :key="view.feed_id"
          class="item"
          @click="goFeed(view.feed_id)"
        >
          <div class="item-header">
            <span class="direction">{{ view.directionLabel }}</span>
            <span class="status">{{ view.statusLabel }}</span>
          </div>
          <div class="item-meta">
            <button class="author-link" type="button" @click.stop="goProfile(view)">
              {{ view.author }}
            </button>
            <span>{{ view.createdLabel }}</span>
          </div>
          <p class="content" @click.stop="goStock(view.target_symbol)">{{ view.summaryText }}</p>
          <div class="meta">时效 {{ view.horizonLabel }} · 剩余 {{ view.remainingDays }} 天</div>
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
  fetchFeedsBySymbolSupabase,
  getRemainingDays,
  getStatusLabel,
  getStatusPhase,
  mapDirectionToLabel,
  mapHorizonToLabel,
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
    return {
      ...view,
      statusPhase: phase,
      statusLabel: getStatusLabel(phase),
      directionLabel: mapDirectionToLabel(view.direction),
      horizonLabel: mapHorizonToLabel(view.horizon),
      createdLabel: formatDate(view.created_at),
      remainingDays: getRemainingDays(view),
      author: view.users?.nickname || "用户",
      summaryText: view.summary || view.content || "",
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
  isLoading.value = false;
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";
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

.item {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 12px;
  border: 1px solid var(--border);
  display: grid;
  gap: 8px;
  cursor: pointer;
}

.item-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.item-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.author-link {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  color: inherit;
  cursor: pointer;
  padding: 0;
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

.empty {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: var(--muted);
}
</style>
