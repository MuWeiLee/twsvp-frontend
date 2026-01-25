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
              :class="{ active: activeResultTab === 'all' }"
              @click="activeResultTab = 'all'"
            >
              全部 {{ stockResults.length + visibleFeedResults.length + userResults.length }}
            </button>
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
              观点 {{ visibleFeedResults.length }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeResultTab === 'user' }"
              @click="activeResultTab = 'user'"
            >
              用户 {{ userResults.length }}
            </button>
          </div>

          <div v-if="activeResultTab === 'all'">
            <div class="result-section">
              <div class="result-title">股票</div>
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

            <div class="result-section">
              <div class="result-title">观点</div>
              <div v-if="visibleFeedResults.length" class="feed">
                <div v-for="view in visibleFeedResults" :key="view.feed_id" class="thread">
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
                        <button
                          class="more-btn"
                          type="button"
                          @click.stop="toggleMenu(view.feed_id)"
                        >
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
                              编辑观点
                            </button>
                            <button
                              v-if="view.statusPhase !== 'ended'"
                              class="menu-item"
                              type="button"
                              @click.stop="handleEndFeed(view)"
                            >
                              手动结束
                            </button>
                            <button
                              class="menu-item danger"
                              type="button"
                              @click.stop="handleDeleteFeed(view)"
                            >
                              删除观点
                            </button>
                          </template>
                          <button
                            v-else
                            class="menu-item"
                            type="button"
                            @click.stop="handleHideFeed(view)"
                          >
                            不看这条
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

            <div class="result-section">
              <div class="result-title">用户</div>
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
          </div>

          <div v-else-if="activeResultTab === 'stock'">
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
            <div v-if="visibleFeedResults.length" class="feed">
              <div v-for="view in visibleFeedResults" :key="view.feed_id" class="thread">
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
                      <button
                        class="more-btn"
                        type="button"
                        @click.stop="toggleMenu(view.feed_id)"
                      >
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
                            编辑观点
                          </button>
                          <button
                            v-if="view.statusPhase !== 'ended'"
                            class="menu-item"
                            type="button"
                            @click.stop="handleEndFeed(view)"
                          >
                            手动结束
                          </button>
                          <button
                            class="menu-item danger"
                            type="button"
                            @click.stop="handleDeleteFeed(view)"
                          >
                            删除观点
                          </button>
                        </template>
                        <button
                          v-else
                          class="menu-item"
                          type="button"
                          @click.stop="handleHideFeed(view)"
                        >
                          不看这条
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
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import { searchUsersSupabase } from "../services/profile.js";
import { searchStocksSupabase } from "../services/stocks.js";
import { supabase } from "../services/supabase.js";
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
const hiddenIds = ref(new Set());
const activeMenuId = ref(null);
const activeResultTab = ref("all");
let suggestTimer = null;
const route = useRoute();
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
    activeResultTab.value = "all";
    router.replace({ path: "/search" });
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
  await runSearch(q);
  router.replace({ path: "/search", query: { q, tab: activeResultTab.value } });
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
  activeResultTab.value = "all";
  router.replace({ path: "/search" });
};

const runSearch = async (q, preferredTab = activeResultTab.value) => {
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
      statusPhase: phase,
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
  activeResultTab.value = getAvailableTab(preferredTab);
  activeMenuId.value = null;
  await loadFeedLikes();
};

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
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

const visibleFeedResults = computed(() =>
  feedResults.value.filter((view) => !hiddenIds.value.has(view.feed_id))
);

const normalizeTab = (tab) => {
  if (tab === "stock" || tab === "feed" || tab === "user" || tab === "all") {
    return tab;
  }
  return "all";
};

const getAvailableTab = (preferred) => {
  const tab = normalizeTab(preferred);
  if (tab === "stock" && !stockResults.value.length) return "all";
  if (tab === "feed" && !feedResults.value.length) return "all";
  if (tab === "user" && !userResults.value.length) return "all";
  return tab;
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

const refreshFeedResults = async () => {
  const q = submittedQuery.value || query.value.trim();
  if (!q) return;
  await runSearch(q, activeResultTab.value);
};

const handleDeleteFeed = async (view) => {
  const confirmed = window.confirm("确定删除这条观点吗？");
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  await refreshFeedResults();
  closeMenu();
};

const handleEndFeed = async (view) => {
  const confirmed = window.confirm("确定结束这条观点吗？");
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ status: "expired", expires_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  await refreshFeedResults();
  closeMenu();
};

const handleEditFeed = async (view) => {
  const nextContent = window.prompt("编辑观点内容", view.content || "");
  if (!nextContent) return;
  await supabase
    .from("feeds")
    .update({ content: nextContent.trim() })
    .eq("feed_id", view.feed_id);
  await refreshFeedResults();
  closeMenu();
};

const buildSearchQuery = () => {
  const q = submittedQuery.value || query.value.trim();
  if (!q) return {};
  return { from: "search", q, tab: activeResultTab.value };
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
  router.push({ path: `/feed/${feedId}`, query: buildSearchQuery() });
};

const goStock = (symbol) => {
  if (!symbol) return;
  router.push({ path: `/stock/${symbol}`, query: buildSearchQuery() });
};

const goProfile = (view) => {
  const userId = view?.user_id;
  if (!userId) return;
  if (currentUserId.value && userId === currentUserId.value) {
    router.push({ path: "/profile", query: buildSearchQuery() });
  } else {
    router.push({ path: `/user/${userId}`, query: buildSearchQuery() });
  }
};

const goUser = (user) => {
  const userId = user?.user_id;
  if (!userId) return;
  if (currentUserId.value && userId === currentUserId.value) {
    router.push({ path: "/profile", query: buildSearchQuery() });
  } else {
    router.push({ path: `/user/${userId}`, query: buildSearchQuery() });
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
onMounted(loadHiddenIds);
onMounted(async () => {
  const q = typeof route.query.q === "string" ? route.query.q.trim() : "";
  if (!q) return;
  query.value = q;
  submittedQuery.value = q;
  await runSearch(q, route.query.tab);
});
watch(
  () => [route.query.q, route.query.tab],
  async ([nextQuery, nextTab]) => {
    const q = typeof nextQuery === "string" ? nextQuery.trim() : "";
    if (!q) return;
    if (q === submittedQuery.value) {
      activeResultTab.value = getAvailableTab(nextTab);
      return;
    }
    query.value = q;
    submittedQuery.value = q;
    await runSearch(q, nextTab);
  }
);
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
  justify-content: flex-start;
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
  text-decoration: none;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  margin-left: auto;
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
  margin-top: 6px;
}

.result-tabs {
  margin-top: 6px;
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
  gap: 16px;
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

.summary {
  color: var(--ink);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-section {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
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

.thread-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.direction {
  padding: 2px 8px;
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
