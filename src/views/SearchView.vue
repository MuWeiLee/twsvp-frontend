<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">搜索</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="search">
        <div class="search-bar">
          <div class="search-input-wrap">
            <input
              class="search-input"
              type="text"
              placeholder="搜索股票、代码、话题或作者"
              v-model="query"
              @input="handleInput"
              @keyup.enter="handleSearch"
            />
            <button
              v-if="query"
              class="clear-btn"
              type="button"
              aria-label="清除搜索"
              @click="clearSearch"
            >
              ×
            </button>
            <div v-if="isSuggesting && !suggestedStocks.length" class="suggest-tip">
              正在联想...
            </div>
            <div v-if="suggestedStocks.length" class="suggest-list">
              <button
                v-for="stock in suggestedStocks"
                :key="stock.stock_id"
                type="button"
                class="suggest-item"
                @click="selectSuggestedStock(stock)"
              >
                <strong>{{ stock.stock_id }} {{ stock.name }}</strong>
                <span>{{ stock.market }}</span>
              </button>
            </div>
          </div>
          <button class="btn-primary" type="button" @click="handleSearch">搜索</button>
        </div>

        <section v-if="submittedQuery">
          <div class="section-title">股票</div>
          <div v-if="stockResults.length" class="list">
            <div
              v-for="item in stockResults"
              :key="item.stock_id"
              class="list-item"
              @click="goStock(item.stock_id)"
            >
              <strong>{{ item.stock_id }} {{ item.name }}</strong>
              <span>{{ item.market }}</span>
            </div>
          </div>
          <div v-else class="empty">暂无相关股票</div>

          <div class="section-title">观点</div>
          <div v-if="feedResults.length" class="feed">
            <div v-for="view in feedResults" :key="view.feed_id" class="thread">
              <div class="thread-card" @click="goFeed(view.feed_id)">
                <div class="thread-header">
                  <div class="stock" @click.stop="goStock(view.target_symbol)">
                    <span class="stock-name">{{ view.target_name }}</span>
                    <span class="stock-code">{{ view.target_symbol }}</span>
                  </div>
                  <span class="tag">{{ view.directionLabel }}</span>
                </div>
                <div class="thread-meta">
                  <button class="author-link" type="button" @click.stop="goProfile(view)">
                    作者 {{ view.author }}
                  </button>
                  <span>{{ view.createdLabel }}</span>
                </div>
                <div class="summary" @click.stop="goStock(view.target_symbol)">
                  {{ view.content }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty">暂无相关观点</div>
        </section>
      </section>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import { searchStocksSupabase } from "../services/stocks.js";
import { mapDirectionToLabel, searchFeedsSupabase } from "../services/feeds.js";

const query = ref("");
const submittedQuery = ref("");
const stockResults = ref([]);
const feedResults = ref([]);
const suggestedStocks = ref([]);
const isSuggesting = ref(false);
const currentUserId = ref("");
let suggestTimer = null;
const router = useRouter();

const handleInput = () => {
  const trimmed = query.value.trim();
  if (!trimmed) {
    submittedQuery.value = "";
    stockResults.value = [];
    feedResults.value = [];
    suggestedStocks.value = [];
    isSuggesting.value = false;
    clearTimeout(suggestTimer);
  } else if (submittedQuery.value) {
    submittedQuery.value = "";
  }
  searchSuggestions();
};

const searchSuggestions = () => {
  const q = query.value.trim();
  clearTimeout(suggestTimer);
  if (!q) {
    suggestedStocks.value = [];
    isSuggesting.value = false;
    return;
  }
  suggestTimer = setTimeout(async () => {
    isSuggesting.value = true;
    suggestedStocks.value = await searchStocksSupabase(q, 6);
    isSuggesting.value = false;
  }, 200);
};

const selectSuggestedStock = (stock) => {
  if (!stock) return;
  query.value = `${stock.stock_id} ${stock.name}`;
  suggestedStocks.value = [];
  goStock(stock.stock_id);
};

const handleSearch = async () => {
  const q = query.value.trim();
  if (!q) return;
  clearTimeout(suggestTimer);
  suggestedStocks.value = [];
  isSuggesting.value = false;
  submittedQuery.value = q;
  const [stocks, feeds] = await Promise.all([
    searchStocksSupabase(q, 8),
    searchFeedsSupabase(q, 15),
  ]);
  stockResults.value = stocks;
  feedResults.value = feeds.map((view) => ({
    ...view,
    author: view.users?.nickname || "用户",
    directionLabel: mapDirectionToLabel(view.direction),
    createdLabel: formatDate(view.created_at),
  }));
};

const clearSearch = () => {
  query.value = "";
  submittedQuery.value = "";
  stockResults.value = [];
  feedResults.value = [];
  suggestedStocks.value = [];
  isSuggesting.value = false;
  clearTimeout(suggestTimer);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
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

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";
};

onMounted(loadUser);
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
  padding: 76px 16px 96px;
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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
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
}

.nav-logo img {
  width: 28px;
  height: 28px;
  display: block;
}

.nav-space {
  width: 32px;
}

.search {
  display: grid;
  gap: 18px;
}

.search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input-wrap {
  position: relative;
  flex: 1;
}

.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-top: 8px;
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

.search-input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 32px 10px 12px;
  font-family: inherit;
  font-size: 14px;
  background: var(--surface);
  width: 100%;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.suggest-tip {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  font-size: 12px;
  color: var(--muted);
}

.suggest-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: grid;
  gap: 2px;
  z-index: 6;
  padding: 6px;
}

.suggest-item {
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink);
}

.suggest-item:hover {
  background: var(--panel);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-top: 6px;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid var(--border);
  font-size: 12px;
}

.list {
  display: grid;
  gap: 10px;
}

.list-item {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  cursor: pointer;
}

.empty {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: var(--muted);
}

.feed {
  display: grid;
  gap: 12px;
}

.thread {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
}

.thread-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ink);
  margin-top: 6px;
}

.thread-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
  cursor: pointer;
}

.stock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stock-name {
  font-size: 14px;
}

.stock-code {
  font-size: 12px;
  color: var(--muted);
}

.summary {
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.thread-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--border);
}

.direction {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
  color: var(--ink);
}

.btn-primary {
  border: 0;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
}

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}
</style>
