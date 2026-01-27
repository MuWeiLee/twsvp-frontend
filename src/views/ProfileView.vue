<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("个人中心") }}</div>
        <button class="nav-action" @click="goSettings">{{ t("设置") }}</button>
      </nav>

      <section class="profile">
        <div class="user-card">
          <div class="profile-avatar" :class="{ empty: !user.avatarUrl }">
            <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" />
            <span v-else>{{ user.initials }}</span>
          </div>
          <div class="user-info">
            <div class="name-row">
              <div class="name">{{ user.name }}</div>
              <button class="edit-btn" type="button" @click="goEditProfile">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M13.5 5l3.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                  />
                </svg>
                {{ t("编辑") }}
              </button>
            </div>
            <div class="joined">{{ t("加入于 {date}", { date: user.joined }) }}</div>
            <div class="bio-row">
              <span class="bio-text">{{ user.bio }}</span>
            </div>
          </div>
        </div>

        <div class="stats">
          <div>
            <div class="stat-label">{{ t("观点总数") }}</div>
            <div class="stat-value">{{ performance.totalViews }}</div>
          </div>
          <div>
            <div class="stat-label">{{ t("观点胜率") }}</div>
            <div class="stat-value">{{ performance.winRate }}</div>
          </div>
          <div>
            <div class="stat-label">{{ t("绩效表现") }}</div>
            <div class="stat-value">{{ performance.performance }}</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: mode === 'all' }"
            @click="mode = 'all'"
          >
            {{ t("全部") }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'active' }"
            @click="mode = 'active'"
          >
            {{ t("进行中") }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'ended' }"
            @click="mode = 'ended'"
          >
            {{ t("已结束") }}
          </button>
        </div>

        <div class="view-list">
          <div
            v-for="view in filteredViews"
            :key="view.feed_id"
            class="view-item"
            @click="goFeed(view.feed_id)"
          >
            <div class="thread-card">
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
                <div class="more-wrap">
                  <button class="more-btn" type="button" @click.stop="toggleMenu(view.feed_id)">
                    ...
                  </button>
                  <div v-if="activeMenuId === view.feed_id" class="more-menu">
                    <button
                      class="menu-item danger"
                      type="button"
                      @click.stop="handleDeleteFeed(view)"
                    >
                      {{ t("删除观点") }}
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
              <div class="summary" @click.stop="goFeed(view.feed_id)">{{ view.content }}</div>
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
        <div v-if="!filteredViews.length" class="empty">{{ t("暂无观点") }}</div>
        <div v-if="hasMore" class="load-more">
          <button class="btn-secondary" type="button" :disabled="isLoadingMore" @click="loadMore">
            {{ isLoadingMore ? t("加载中...") : t("加载更多") }}
          </button>
        </div>

        <p class="legal">
          {{ t("任何观点仅作为记录与回溯，不作为预测价格与投资建议。") }}
        </p>
      </section>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";
import { supabase } from "../services/supabase.js";
import { t } from "../services/i18n.js";
import {
  addFeedLikeSupabase,
  fetchFeedsSupabase,
  fetchFeedLikesSupabase,
  formatFeedTimestamp,
  getRemainingDays,
  getStatusLabel,
  getStatusDisplay,
  getStatusPhase,
  mapDirectionToLabel,
  removeFeedLikeSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";

const router = useRouter();
const mode = ref("all");
const user = ref({
  initials: "",
  name: "",
  bio: "",
  avatarUrl: "",
  joined: "—",
});
const feeds = ref([]);
const likedIds = ref(new Set());
const currentUserId = ref("");
const activeMenuId = ref(null);
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const PAGE_SIZE = 20;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const viewsWithStatus = computed(() =>
  feeds.value.map((view) => {
    const phase = getStatusPhase(view);
    const author = view.users?.nickname || user.value.name || t("用户");
    return {
      ...view,
      statusPhase: phase,
      statusLabel: getStatusLabel(phase),
      statusDisplay: getStatusDisplay(view, phase),
      directionLabel: mapDirectionToLabel(view.direction),
      createdLabel: formatFeedTimestamp(view.created_at),
      createdDateLabel: formatFeedTimestamp(view.created_at),
      remainingDays: getRemainingDays(view),
      author,
      authorAvatar: view.users?.avatar_url || "",
      authorInitial: getInitials(author),
      isLiked: likedIds.value.has(view.feed_id),
    };
  })
);

const performance = computed(() => {
  const totalViews = feeds.value.length;
  return {
    totalViews,
    winRate: totalViews ? t("待结算") : "—",
    performance: totalViews ? t("待结算") : "—",
  };
});

const filteredViews = computed(() => {
  const list = viewsWithStatus.value;
  if (mode.value === "all") return list;
  return list.filter((view) => view.statusPhase === mode.value);
});

const loadFeeds = async ({ append = false } = {}) => {
  if (!currentUserId.value) return;
  const data = await fetchFeedsSupabase({
    userId: currentUserId.value,
    page: page.value,
    pageSize: PAGE_SIZE,
  });
  const nextFeeds = append ? [...feeds.value, ...data] : data;
  feeds.value = nextFeeds;
  hasMore.value = data.length === PAGE_SIZE;
  await loadLikedIds(nextFeeds);
};

const loadProfile = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  if (!supabaseUser) {
    router.replace("/login");
    return;
  }

  currentUserId.value = supabaseUser.id;
  const profile = await getProfileSupabase(supabaseUser.id);

  const nickname =
    profile?.nickname ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    (supabaseUser.email ? supabaseUser.email.split("@")[0] : t("用户"));

  const avatarUrl = profile?.avatar_url || supabaseUser.user_metadata?.avatar_url || "";

  user.value = {
    initials: getInitials(nickname),
    name: nickname,
    bio: profile?.bio || t("尚未填写简介"),
    avatarUrl,
    joined: formatDate(profile?.created_at || supabaseUser.created_at),
  };
  page.value = 1;
  hasMore.value = true;
  await loadFeeds();
};

const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value) return;
  isLoadingMore.value = true;
  page.value += 1;
  await loadFeeds({ append: true });
  isLoadingMore.value = false;
};

const goFeed = (feedId) => {
  router.push(`/feed/${feedId}`);
};

const goStock = (view) => {
  const symbol = view?.target_symbol;
  if (!symbol) return;
  router.push(`/stock/${symbol}`);
};

const goProfile = () => {
  router.push("/profile");
};

const loadLikedIds = async (list = feeds.value) => {
  if (!currentUserId.value || !list.length) {
    likedIds.value = new Set();
    return;
  }
  const feedIds = list.map((view) => view.feed_id);
  likedIds.value = await fetchFeedLikesSupabase(currentUserId.value, feedIds);
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
      feeds.value[feedIndex] = {
        ...feeds.value[feedIndex],
        like_count: revertCount,
      };
    }
    await loadLikedIds();
  }
};

const toggleMenu = (feedId) => {
  activeMenuId.value = activeMenuId.value === feedId ? null : feedId;
};

const closeMenu = () => {
  activeMenuId.value = null;
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

const goSettings = () => {
  router.push("/settings");
};

const goEditProfile = () => {
  router.push("/personal-setting");
};

onMounted(loadProfile);
watch(mode, () => {
  window.scrollTo({ top: 0, behavior: "auto" });
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
  padding: 76px 16px 140px;
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
}

.nav-action {
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

.profile {
  display: grid;
  gap: 18px;
}

.user-card {
  display: flex;
  gap: 12px;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 14px;
}

.user-info {
  display: grid;
  gap: 6px;
  width: 100%;
}

.name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  border: 1px solid var(--border);
  box-shadow: 0 6px 14px rgba(15, 20, 25, 0.08);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: var(--ink);
  overflow: hidden;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.name {
  font-weight: 600;
}

.joined {
  font-size: 12px;
  color: var(--muted);
}

.edit-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.edit-btn svg {
  width: 14px;
  height: 14px;
}

.bio-row {
  display: grid;
  gap: 4px;
  font-size: 12px;
}

.bio-text {
  color: var(--ink);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stats > div {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 12px;
}

.stat-label {
  font-size: 12px;
  color: var(--muted);
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
}

.tabs {
  margin-top: 6px;
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

.view-list {
  display: grid;
  gap: 14px;
}

.view-item {
  display: block;
  cursor: pointer;
}

.thread-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
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

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}

@media (max-width: 360px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
