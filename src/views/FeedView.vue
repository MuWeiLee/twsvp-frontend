<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <button class="nav-logo" type="button" :aria-label="t('刷新观点')" @click="refreshFeeds">
          <img :src="logoUrl" alt="TWSVP" />
        </button>
        <div class="nav-title">{{ t("观点") }}</div>
        <router-link class="nav-btn" to="/search" :aria-label="t('搜索')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r="7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
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
            :class="{ active: activeTab === 'all' }"
            @click="activeTab = 'all'"
          >
            {{ t("全部") }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'follow' }"
            @click="activeTab = 'follow'"
          >
            {{ t("关注") }}
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
        <section class="feed">
          <div v-if="activeTab === 'follow' && !hasFollows" class="follow-empty">
            <div class="result-title">{{ t("近14天观点最多的股票") }}</div>
            <div class="list">
              <div
                v-for="stock in recommendedStocks"
                :key="stock.symbol"
                class="list-item"
                @click="goRecommendedStock(stock)"
              >
                <strong>{{ stock.symbol }} {{ stock.name }}</strong>
                <span v-if="stock.market">{{ stock.market }}</span>
              </div>
            </div>
            <div class="recommend-divider"></div>
            <div class="result-title">{{ t("近30天观点最多的用户") }}</div>
            <div class="user-list">
              <div
                v-for="person in recommendedUsers"
                :key="person.user_id"
                class="user-card"
                @click="goRecommendedUser(person)"
              >
                <strong>{{ person.nickname }}</strong>
                <span>{{ person.bio || t("这个人很懒，什么都没留下") }}</span>
              </div>
            </div>
            <button class="recommend-action" type="button" @click="handleQuickFollow">
              {{ t("+ 一键关注") }}
            </button>
          </div>
          <template v-else>
            <div v-for="view in filteredViews" :key="view.feed_id" class="thread slide-in">
              <div class="thread-card" @click="goFeed(view.feed_id)">
                <div class="thread-header">
                  <div class="header-left">
                    <div class="stock" @click.stop="goStock(view)">
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
                        <template v-if="view.isAuthor">
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
                <div class="summary" @click.stop="goFeed(view.feed_id)">{{ view.content }}</div>
                <div class="thread-footer">
                  <span class="created-at">{{ view.createdDateLabel }}</span>
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
              {{ t("暂无观点，先发布一条吧。") }}
            </div>
            <div ref="loadTrigger" class="load-trigger">
              <span v-if="isLoadingMore">{{ t("加载中...") }}</span>
              <span v-else-if="hasMore">{{ t("下滑加载更多") }}</span>
              <span v-else>{{ t("已加载全部") }}</span>
            </div>
          </template>
        </section>
      </div>

      <BottomTabbar />

      <p class="legal">
        {{ t("任何观点仅作为记录与回溯，不作为预测价格与投资建议。") }}
      </p>
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import FeedEditSheet from "../components/FeedEditSheet.vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";
import { t } from "../services/i18n.js";
import { getFollowErrorMessage } from "../services/followErrors.js";
import {
  addFeedLikeSupabase,
  attachFeedPerformance,
  fetchFeedsSupabase,
  fetchFeedLikesSupabase,
  formatFeedPercent,
  formatFeedTimestamp,
  getReplyCount,
  getRemainingDays,
  getStatusDisplay,
  getStatusPhase,
  mapDirectionToLabel,
  removeFeedLikeSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";
import { supabase } from "../services/supabase.js";

const router = useRouter();
const activeTab = ref("all");
const user = ref({
  initials: "",
});
const feeds = ref([]);
const isLoading = ref(false);
const likedIds = ref(new Set());
const hiddenIds = ref(new Set());
const currentUserId = ref("");
const activeMenuId = ref(null);
const isEditOpen = ref(false);
const isEditSaving = ref(false);
const editingFeed = ref(null);
const showTabs = ref(true);
const lastScrollY = ref(0);
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const isRefreshing = ref(false);
const PAGE_SIZE = 20;
const PULL_THRESHOLD = 60;
const PULL_MAX = 90;
const FOLLOW_USERS_KEY = "twsvp_followed_users";
const FOLLOW_STOCKS_KEY = "twsvp_followed_stocks";
const loadTrigger = ref(null);
const scrollContainer = ref(null);
const pullDistance = ref(0);
const touchStartY = ref(null);
const followedUsers = ref(new Set());
const followedStocks = ref(new Set());
const recommendedUsers = ref([]);
const recommendedStocks = ref([]);
const isLoadingRecommendations = ref(false);
let loadObserver = null;

const refreshLabel = computed(() => {
  if (isRefreshing.value) return t("刷新中...");
  if (pullDistance.value >= PULL_THRESHOLD) return t("松开刷新");
  return t("下拉刷新");
});

const hasFollows = computed(
  () => followedUsers.value.size > 0 || followedStocks.value.size > 0
);

const filteredViews = computed(() => {
  const list = feeds.value
    .filter((view) => !hiddenIds.value.has(view.feed_id))
    .map((view) => {
      const phase = getStatusPhase(view);
      const performancePct = view.performance_pct ?? null;
      const performanceDirection =
        performancePct > 0 ? "up" : performancePct < 0 ? "down" : "neutral";
      const performanceLabel = formatFeedPercent(performancePct);
      return {
        ...view,
        statusPhase: phase,
        statusDisplay: getStatusDisplay(view, phase),
        directionLabel: mapDirectionToLabel(view.direction),
        remainingDays: getRemainingDays(view),
        createdLabel: formatFeedTimestamp(view.created_at),
        createdDateLabel: formatFeedTimestamp(view.created_at),
        author: view.users?.nickname || t("用户"),
        authorAvatar: view.users?.avatar_url || "",
        authorInitial: getInitials(view.users?.nickname || t("用户")),
        isLiked: likedIds.value.has(view.feed_id),
        isAuthor: currentUserId.value && view.user_id === currentUserId.value,
        canEdit: canEditFeed(view),
        replyCount: getReplyCount(view),
        performancePct,
        performanceDirection,
        performanceLabel,
      };
    });

  return list;
});

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase({ force: true });
  if (!supabaseUser) {
    return;
  }
  currentUserId.value = supabaseUser.id;

  const profile = await getProfileSupabase(supabaseUser.id);
  const nickname =
    profile?.nickname ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    (supabaseUser.email ? supabaseUser.email.split("@")[0] : "");

  user.value.initials = getInitials(nickname);
  await loadLikedIds();
};

const canEditFeed = (view) => {
  if (!currentUserId.value || view.user_id !== currentUserId.value) {
    return false;
  }
  const createdAt = new Date(view.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 10 * 60 * 1000;
};

const loadLikedIds = async (list = feeds.value) => {
  if (!currentUserId.value) {
    likedIds.value = new Set();
    return;
  }
  const feedIds = list.map((view) => view.feed_id);
  likedIds.value = await fetchFeedLikesSupabase(currentUserId.value, feedIds);
};

const loadFeeds = async ({ append = false } = {}) => {
  if (activeTab.value === "follow") {
    await loadFollowFeeds({ append });
    return;
  }
  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
  }
  const data = await fetchFeedsSupabase({
    status: "all",
    page: page.value,
    pageSize: PAGE_SIZE,
  });
  const nextFeeds = append ? [...feeds.value, ...data] : data;
  feeds.value = nextFeeds;
  hasMore.value = data.length === PAGE_SIZE;
  await loadLikedIds(nextFeeds);
  if (append) {
    isLoadingMore.value = false;
  } else {
    isLoading.value = false;
  }
};

const loadFollowFeeds = async ({ append = false } = {}) => {
  if (!hasFollows.value) {
    feeds.value = [];
    hasMore.value = false;
    isLoading.value = false;
    isLoadingMore.value = false;
    await loadRecommendations();
    return;
  }
  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
  }
  const userIds = [...followedUsers.value];
  const symbols = [...followedStocks.value];
  let query = supabase
    .from("feeds")
    .select(
      "feed_id, user_id, target_symbol, target_name, direction, horizon, content, summary, status, expires_at, created_at, like_count, feed_replies(count), users!feeds_user_id_fkey(nickname, avatar_url)"
    )
    .is("deleted_at", null);

  if (userIds.length && symbols.length) {
    const userFilter = userIds.map((id) => `"${id}"`).join(",");
    const symbolFilter = symbols.map((symbol) => `"${symbol}"`).join(",");
    query = query.or(`user_id.in.(${userFilter}),target_symbol.in.(${symbolFilter})`);
  } else if (userIds.length) {
    query = query.in("user_id", userIds);
  } else if (symbols.length) {
    query = query.in("target_symbol", symbols);
  }

  query = query.order("created_at", { ascending: false });
  const from = (page.value - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await query.range(from, to);
  if (error) {
    console.error("读取关注 feeds 失败:", error);
  }
  const rows = await attachFeedPerformance(data || []);
  const nextFeeds = append ? [...feeds.value, ...rows] : rows;
  feeds.value = nextFeeds;
  hasMore.value = rows.length === PAGE_SIZE;
  await loadLikedIds(nextFeeds);
  if (append) {
    isLoadingMore.value = false;
  } else {
    isLoading.value = false;
  }
};

const loadFollowState = () => {
  try {
    const rawUsers = localStorage.getItem(FOLLOW_USERS_KEY);
    const rawStocks = localStorage.getItem(FOLLOW_STOCKS_KEY);
    const users = rawUsers ? JSON.parse(rawUsers) : [];
    const stocks = rawStocks ? JSON.parse(rawStocks) : [];
    followedUsers.value = new Set((users || []).filter(Boolean));
    followedStocks.value = new Set((stocks || []).filter(Boolean));
  } catch (error) {
    followedUsers.value = new Set();
    followedStocks.value = new Set();
  }
};

const saveFollowState = () => {
  localStorage.setItem(FOLLOW_USERS_KEY, JSON.stringify([...followedUsers.value]));
  localStorage.setItem(FOLLOW_STOCKS_KEY, JSON.stringify([...followedStocks.value]));
};

const loadRecommendations = async () => {
  if (isLoadingRecommendations.value) return;
  isLoadingRecommendations.value = true;
  try {
    const now = Date.now();
    const userSince = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const stockSince = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [userRows, stockRows] = await Promise.all([
      supabase
        .from("feeds")
        .select("user_id, created_at, users!feeds_user_id_fkey(nickname,bio)")
        .is("deleted_at", null)
        .gte("created_at", userSince)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("feeds")
        .select("target_symbol, target_name, created_at")
        .is("deleted_at", null)
        .gte("created_at", stockSince)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (userRows.error) {
      console.error("读取关注用户推荐失败:", userRows.error);
    }
    if (stockRows.error) {
      console.error("读取关注股票推荐失败:", stockRows.error);
    }
    const userMap = new Map();
    (userRows.data || []).forEach((row) => {
      if (!row.user_id) return;
      if (currentUserId.value && row.user_id === currentUserId.value) return;
      const nickname = row.users?.nickname || t("用户");
      const bio = row.users?.bio || "";
      const entry = userMap.get(row.user_id) || {
        user_id: row.user_id,
        nickname,
        bio,
        count: 0,
      };
      entry.count += 1;
      userMap.set(row.user_id, entry);
    });
    recommendedUsers.value = [...userMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const stockMap = new Map();
    (stockRows.data || []).forEach((row) => {
      const symbol = row.target_symbol;
      if (!symbol) return;
      const name = row.target_name || symbol;
      const entry = stockMap.get(symbol) || {
        symbol,
        name,
        market: row.market || "",
        count: 0,
      };
      entry.count += 1;
      stockMap.set(symbol, entry);
    });
    recommendedStocks.value = [...stockMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  } finally {
    isLoadingRecommendations.value = false;
  }
};

const handleQuickFollow = async () => {
  const supabaseUser = await getCurrentUserSupabase({ force: true, ensureSession: true });
  const authUserId = supabaseUser?.id || "";
  currentUserId.value = authUserId;
  if (!authUserId) {
    window.alert(t("请重新登录后再关注"));
    router.push("/login");
    return;
  }
  const followRows = [];
  const nextFollowedUsers = new Set(followedUsers.value);
  recommendedUsers.value.forEach((item) => {
    if (item.user_id) nextFollowedUsers.add(item.user_id);
    if (item.user_id && item.user_id !== authUserId) {
      followRows.push({
        follower_id: authUserId,
        followee_id: item.user_id,
      });
    }
  });
  const stockRows = [];
  const nextFollowedStocks = new Set(followedStocks.value);
  recommendedStocks.value.forEach((item) => {
    if (item.symbol) nextFollowedStocks.add(item.symbol);
    if (item.symbol) {
      stockRows.push({
        user_id: authUserId,
        stock_symbol: item.symbol,
      });
    }
  });
  if (followRows.length) {
    const { error } = await supabase.from("user_follows").insert(followRows, {
      onConflict: "follower_id,followee_id",
      ignoreDuplicates: true,
    });
    if (error) {
      console.error("一键关注用户失败:", error);
      window.alert(getFollowErrorMessage(error, { action: "follow" }));
      return;
    }
  }
  if (stockRows.length) {
    const { error } = await supabase.from("user_stock_follows").upsert(stockRows, {
      onConflict: "user_id,stock_symbol",
    });
    if (error) {
      console.error("一键关注股票失败:", error);
      window.alert(getFollowErrorMessage(error, { action: "follow" }));
      return;
    }
  }
  followedUsers.value = nextFollowedUsers;
  followedStocks.value = nextFollowedStocks;
  saveFollowState();
  page.value = 1;
  hasMore.value = true;
  await loadFeeds();
};

const refreshFeeds = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  page.value = 1;
  hasMore.value = true;
  await loadFeeds();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({ top: 0, behavior: "smooth" });
  }
  isRefreshing.value = false;
};

const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) return;
  page.value += 1;
  await loadFeeds({ append: true });
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

const handleDeleteFeed = async (view) => {
  const confirmed = window.confirm(t("确定删除这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  feeds.value = feeds.value.filter((item) => item.feed_id !== view.feed_id);
  closeMenu();
};

const handleEndFeed = async (view) => {
  const confirmed = window.confirm(t("确定结束这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ status: "expired", expires_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  await loadFeeds();
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
  await loadFeeds();
  isEditSaving.value = false;
  closeEdit();
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
  const feedIndex = feeds.value.findIndex((item) => item.feed_id === view.feed_id);
  if (feedIndex !== -1) {
    feeds.value[feedIndex] = {
      ...feeds.value[feedIndex],
      like_count: nextCount,
    };
  }
  if (alreadyLiked) {
    const nextIds = new Set(likedIds.value);
    nextIds.delete(view.feed_id);
    likedIds.value = nextIds;
  } else {
    const nextIds = new Set(likedIds.value);
    nextIds.add(view.feed_id);
    likedIds.value = nextIds;
  }
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
      feeds.value[feedIndex] = {
        ...feeds.value[feedIndex],
        like_count: revertCount,
      };
    }
    await loadLikedIds();
  }
};

const goFeed = (feedId) => {
  router.push(`/feed/${feedId}`);
};

const goStock = (view) => {
  const symbol = view?.target_symbol;
  if (!symbol) return;
  router.push(`/stock/${symbol}`);
};

const goRecommendedStock = (stock) => {
  const symbol = stock?.symbol;
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

const goRecommendedUser = (userItem) => {
  const userId = userItem?.user_id;
  if (!userId) return;
  if (currentUserId.value && userId === currentUserId.value) {
    router.push("/profile");
  } else {
    router.push(`/user/${userId}`);
  }
};

const handleTouchStart = (event) => {
  if (isRefreshing.value || isLoading.value) return;
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
    await refreshFeeds();
  }
  pullDistance.value = 0;
  touchStartY.value = null;
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

onMounted(loadUser);
onMounted(loadFeeds);
onMounted(loadHiddenIds);
onMounted(loadFollowState);
onMounted(async () => {
  await nextTick();
  if (scrollContainer.value) {
    lastScrollY.value = scrollContainer.value.scrollTop || 0;
    scrollContainer.value.addEventListener("scroll", handleScroll, { passive: true });
  }
});
onMounted(async () => {
  await nextTick();
  setupInfiniteScroll();
});
onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener("scroll", handleScroll);
  }
  if (loadObserver) {
    loadObserver.disconnect();
  }
});
watch(activeTab, async () => {
  page.value = 1;
  hasMore.value = true;
  if (activeTab.value === "follow" && !hasFollows.value) {
    await loadRecommendations();
  }
  await loadFeeds();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({ top: 0, behavior: "auto" });
  }
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

.nav-btn svg {
  width: 18px;
  height: 18px;
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
  width: 28px;
  height: 28px;
  display: block;
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

.feed {
  margin-top: 12px;
  display: grid;
  gap: 16px;
}

.follow-empty {
  display: grid;
  gap: 14px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
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

.recommend-divider {
  height: 1px;
  background: var(--border);
}

.recommend-action {
  border: 0;
  background: var(--ink);
  color: var(--surface);
  font-size: 14px;
  font-weight: 600;
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  justify-self: start;
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

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  flex-wrap: wrap;
}

.header-right {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
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

.more-btn {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 16px;
  cursor: pointer;
  color: var(--muted);
}

.more-wrap {
  position: relative;
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
  z-index: 6;
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

.author {
  display: flex;
  align-items: center;
  gap: 8px;
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
  display: block;
}

.author-name {
  font-size: 12px;
  color: var(--ink);
}

.status {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
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

.summary {
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.created-at {
  font-size: 12px;
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
  background: var(--bg);
  z-index: 4;
}

.empty {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  padding: 12px 0;
}

.fade-in {
  animation: fadeIn 650ms ease both;
}

.slide-in {
  animation: slideUp 500ms ease both;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .feed-scroll {
    padding: calc(var(--nav-height) + var(--tabs-height) + var(--header-gap) + env(safe-area-inset-top, 0px))
      16px
      calc(140px + env(safe-area-inset-bottom, 0px));
  }

  .composer-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-primary {
    width: 100%;
  }
}
</style>
