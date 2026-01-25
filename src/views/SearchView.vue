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
          <div class="tabs result-tabs">
            <button
              class="tab-btn"
              :class="{ active: activeResultTab === 'stock' }"
              @click="activeResultTab = 'stock'"
            >
              股票 {{ stockResults.length }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeResultTab === 'feed' }"
              @click="activeResultTab = 'feed'"
            >
              观点 {{ feedResults.length }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeResultTab === 'user' }"
              @click="activeResultTab = 'user'"
            >
              用户 {{ userResults.length }}
            </button>
          </div>

          <div v-if="activeResultTab === 'stock'">
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
          </div>

          <div v-else-if="activeResultTab === 'feed'">
            <div v-if="feedResults.length" class="feed">
              <div v-for="view in feedResults" :key="view.feed_id" class="thread">
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
                  <div class="summary" @click.stop="goFeed(view.feed_id)">
                    {{ view.content }}
                  </div>
                  <div class="thread-footer">
                    <span class="created-at">{{ view.createdDateLabel }}</span>
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
            <div v-else class="empty">暂无相关观点</div>
          </div>

          <div v-else>
            <div v-if="userResults.length" class="user-list">
              <div
                v-for="user in userResults"
                :key="user.user_id"
                class="user-card"
                @click="goUser(user)"
              >
                <strong>{{ user.nickname || "用户" }}</strong>
                <span>{{ user.bio || "暂无简介" }}</span>
              </div>
            </div>
            <div v-else class="empty">暂无相关用户</div>
          </div>
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
import { searchUsersSupabase } from "../services/profile.js";
import { searchStocksSupabase } from "../services/stocks.js";
import {
  addFeedLikeSupabase,
  fetchFeedLikesSupabase,
  formatFeedTimestamp,
  getStatusDisplay,
  getStatusPhase,
  mapDirectionToLabel,
  removeFeedLikeSupabase,
  searchFeedsSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";

const query = ref("");
const submittedQuery = ref("");
const stockResults = ref([]);
const feedResults = ref([]);
const userResults = ref([]);
const suggestedStocks = ref([]);
const isSuggesting = ref(false);
const currentUserId = ref("");
const likedIds = ref(new Set());
const activeResultTab = ref("stock");
let suggestTimer = null;
const router = useRouter();

const handleInput = () => {
  const trimmed = query.value.trim();
  if (!trimmed) {
    submittedQuery.value = "";
    stockResults.value = [];
    feedResults.value = [];
    userResults.value = [];
    suggestedStocks.value = [];
    isSuggesting.value = false;
    clearTimeout(suggestTimer);
    activeResultTab.value = "stock";
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
  const [stocks, feeds, users] = await Promise.all([
    searchStocksSupabase(q, 8),
    searchFeedsSupabase(q, 15),
    searchUsersSupabase(q, 12),
  ]);
  stockResults.value = stocks;
  feedResults.value = feeds.map((view) => {
    const phase = getStatusPhase(view);
    const author = view.users?.nickname || "用户";
    return {
      ...view,
      author,
      authorAvatar: view.users?.avatar_url || "",
      authorInitial: getInitials(author),
      directionLabel: mapDirectionToLabel(view.direction),
      statusDisplay: getStatusDisplay(view, phase),
      createdLabel: formatFeedTimestamp(view.created_at),
      createdDateLabel: formatFeedTimestamp(view.created_at),
      isLiked: false,
    };
  });
  userResults.value = users;
  activeResultTab.value = getDefaultTab();
  await loadFeedLikes();
};

const clearSearch = () => {
  query.value = "";
  submittedQuery.value = "";
  stockResults.value = [];
  feedResults.value = [];
  userResults.value = [];
  suggestedStocks.value = [];
  isSuggesting.value = false;
  clearTimeout(suggestTimer);
  likedIds.value = new Set();
  activeResultTab.value = "stock";
};

const getDefaultTab = () => {
  if (stockResults.value.length) return "stock";
  if (feedResults.value.length) return "feed";
  if (userResults.value.length) return "user";
  return "stock";
};

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const loadFeedLikes = async (list = feedResults.value) => {
  if (!currentUserId.value || !list.length) {
    likedIds.value = new Set();
    return;
  }
  const feedIds = list.map((view) => view.feed_id);
  likedIds.value = await fetchFeedLikesSupabase(currentUserId.value, feedIds);
  feedResults.value = feedResults.value.map((view) => ({
    ...view,
    isLiked: likedIds.value.has(view.feed_id),
  }));
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

const goUser = (user) => {
  const userId = user?.user_id;
  if (!userId) return;
  if (currentUserId.value && userId === currentUserId.value) {
    router.push("/profile");
  } else {
    router.push(`/user/${userId}`);
  }
};

const toggleLike = async (view) => {
  if (!currentUserId.value) {
    router.replace("/login");
    return;
  }
  const alreadyLiked = likedIds.value.has(view.feed_id);
  const delta = alreadyLiked ? -1 : 1;
  view.like_count = Math.max(0, (view.like_count || 0) + delta);
  view.isLiked = !alreadyLiked;
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
    view.like_count = Math.max(0, (view.like_count || 0) - delta);
    view.isLiked = alreadyLiked;
    await loadFeedLikes();
  }
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";
  await loadFeedLikes();
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

.result-tabs {
  margin-top: 12px;
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

.user-list {
  display: grid;
  gap: 12px;
}

.user-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 10px 12px;
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.user-card span {
  font-size: 12px;
  color: var(--muted);
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
  display: block;
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

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
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
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.direction {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
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
