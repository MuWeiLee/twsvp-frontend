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
        <div class="nav-title">{{ t("个人主页") }}</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="profile">
        <div class="user-card">
          <div class="profile-avatar">{{ user.initials }}</div>
          <div class="user-info">
            <div class="name-row">
              <div class="name">{{ user.name }}</div>
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
            <div class="stat-value">{{ stats.totalViews }}</div>
          </div>
          <div>
            <div class="stat-label">{{ t("已结束") }}</div>
            <div class="stat-value">{{ stats.closedViews }}</div>
          </div>
          <div>
            <div class="stat-label">{{ t("胜率") }}</div>
            <div class="stat-value">{{ stats.winRate }}</div>
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
            :class="{ active: mode === 'pending' }"
            @click="mode = 'pending'"
          >
            {{ t("未开始") }}
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
      </section>

      <p class="legal">
        {{ t("任何观点仅作为记录与回溯，不作为预测价格与投资建议。") }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase, getUserGroupNamesSupabase } from "../services/profile.js";
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

const route = useRoute();
const router = useRouter();
const mode = ref("all");
const user = ref({
  initials: "",
  name: "",
  bio: "",
  tags: [],
  joined: "—",
});
const feeds = ref([]);
const likedIds = ref(new Set());
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

const stats = computed(() => {
  const totalViews = feeds.value.length;
  const closedViews = viewsWithStatus.value.filter(
    (view) => view.statusPhase === "ended"
  ).length;
  return {
    totalViews,
    closedViews,
    winRate: totalViews ? t("待结算") : "—",
  };
});

const filteredViews = computed(() => {
  const list = viewsWithStatus.value;
  if (mode.value === "all") return list;
  return list.filter((view) => view.statusPhase === mode.value);
});

const loadProfile = async () => {
  const userId = route.params.id;
  if (!userId || Array.isArray(userId)) {
    return;
  }

  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";

  const [profile, tags] = await Promise.all([
    getProfileSupabase(userId),
    getUserGroupNamesSupabase(userId),
  ]);

  const nickname = profile?.nickname || t("用户");

  user.value = {
    initials: getInitials(nickname),
    name: nickname,
    bio: profile?.bio || t("尚未填写简介"),
    tags,
    joined: formatDate(profile?.created_at),
  };

  const data = await fetchFeedsSupabase({ userId });
  feeds.value = data;
  await loadLikedIds(data);
};

const goFeed = (feedId) => {
  if (!feedId) return;
  router.push(`/feed/${feedId}`);
};

const goStock = (view) => {
  const symbol = view?.target_symbol;
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

const handleBack = () => {
  if (route.query.from === "search") {
    const q = typeof route.query.q === "string" ? route.query.q : "";
    const tab = typeof route.query.tab === "string" ? route.query.tab : "all";
    router.push({ path: "/search", query: q ? { q, tab } : { tab } });
    return;
  }
  router.push("/feed");
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

onMounted(loadProfile);
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
  padding: 76px 16px 40px;
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
}

.user-info {
  display: grid;
  gap: 6px;
  width: 100%;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  font-weight: 600;
}

.joined {
  font-size: 12px;
  color: var(--muted);
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
  margin-top: 4px;
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
}

.summary {
  color: var(--ink);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
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

.empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

.legal {
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
}

@media (max-width: 360px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
