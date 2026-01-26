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
        <div class="nav-title">{{ t("观点详情") }}</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="thread-card" v-if="feed">
        <div class="thread-header">
          <div class="header-left">
            <div class="stock" @click.stop="goStock(feed)">
              <span class="stock-name">{{ feed.target_name }}</span>
              <span class="stock-code">{{ feed.target_symbol }}</span>
            </div>
            <span class="direction" :class="feed.direction">
              {{ feed.directionLabel }}
            </span>
          </div>
          <div class="more-wrap">
            <button class="more-btn" type="button" @click.stop="toggleMenu">...</button>
            <div v-if="menuOpen" class="more-menu">
              <template v-if="feed.isAuthor">
                <button
                  v-if="feed.canEdit"
                  class="menu-item"
                  type="button"
                  @click.stop="handleEditFeed"
                >
                  {{ t("编辑观点") }}
                </button>
                <button
                  v-if="feed.statusPhase !== 'ended'"
                  class="menu-item"
                  type="button"
                  @click.stop="handleEndFeed"
                >
                  {{ t("手动结束") }}
                </button>
                <button class="menu-item danger" type="button" @click.stop="handleDeleteFeed">
                  {{ t("删除观点") }}
                </button>
              </template>
              <button v-else class="menu-item" type="button" @click.stop="handleHideFeed">
                {{ t("不看这条") }}
              </button>
            </div>
          </div>
        </div>
        <div class="thread-meta">
          <div class="author" @click.stop="goProfile(feed)">
            <span class="avatar" :class="{ empty: !feed.authorAvatar }">
              <img v-if="feed.authorAvatar" :src="feed.authorAvatar" alt="" />
              <span v-else>{{ feed.authorInitial }}</span>
            </span>
            <span class="author-name">{{ feed.author }}</span>
          </div>
          <span class="status">{{ feed.statusDisplay }}</span>
        </div>
        <div class="summary">{{ feed.content }}</div>
        <div class="thread-footer">
          <span class="created-at">{{ feed.createdDateLabel }}</span>
          <button
            class="like-btn"
            type="button"
            :class="{ active: feed.isLiked }"
            @click="toggleLike"
          >
            👍 {{ feed.like_count }}
          </button>
        </div>
      </section>
      <section v-else class="thread-card empty">{{ t("暂无该观点。") }}</section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { t } from "../services/i18n.js";
import { supabase } from "../services/supabase.js";
import {
  addFeedLikeSupabase,
  fetchFeedByIdSupabase,
  fetchFeedLikesSupabase,
  formatFeedTimestamp,
  getStatusDisplay,
  getStatusPhase,
  mapDirectionToLabel,
  removeFeedLikeSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";

const route = useRoute();
const router = useRouter();
const feed = ref(null);
const likedIds = ref(new Set());
const currentUserId = ref("");
const menuOpen = ref(false);

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const loadLikedIds = async (feedId = feed.value?.feed_id) => {
  if (!currentUserId.value || !feedId) {
    likedIds.value = new Set();
    if (feed.value) {
      feed.value.isLiked = false;
    }
    return;
  }
  likedIds.value = await fetchFeedLikesSupabase(currentUserId.value, [feedId]);
  if (feed.value) {
    feed.value.isLiked = likedIds.value.has(feed.value.feed_id);
  }
};

const canEditFeed = (view) => {
  if (!currentUserId.value || view.user_id !== currentUserId.value) {
    return false;
  }
  const createdAt = new Date(view.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 10 * 60 * 1000;
};

const toggleLike = async () => {
  if (!feed.value) return;
  if (!currentUserId.value) {
    router.replace("/login");
    return;
  }
  const alreadyLiked = likedIds.value.has(feed.value.feed_id);
  const delta = alreadyLiked ? -1 : 1;
  const nextCount = Math.max(0, (feed.value.like_count || 0) + delta);
  feed.value.like_count = nextCount;
  feed.value.isLiked = !alreadyLiked;
  if (alreadyLiked) {
    const nextIds = new Set(likedIds.value);
    nextIds.delete(feed.value.feed_id);
    likedIds.value = nextIds;
  } else {
    const nextIds = new Set(likedIds.value);
    nextIds.add(feed.value.feed_id);
    likedIds.value = nextIds;
  }
  const ok = alreadyLiked
    ? await removeFeedLikeSupabase(currentUserId.value, feed.value.feed_id)
    : await addFeedLikeSupabase(currentUserId.value, feed.value.feed_id);
  if (ok) {
    await updateFeedLikeCountSupabase(feed.value.feed_id, delta);
  } else {
    const revertCount = Math.max(0, (feed.value.like_count || 0) - delta);
    feed.value.like_count = revertCount;
    feed.value.isLiked = alreadyLiked;
    await loadLikedIds(feed.value.feed_id);
  }
};

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const closeMenu = () => {
  menuOpen.value = false;
};

const handleEditFeed = async () => {
  if (!feed.value) return;
  const nextContent = window.prompt(t("编辑观点内容"), feed.value.content || "");
  if (!nextContent) return;
  await supabase
    .from("feeds")
    .update({ content: nextContent.trim() })
    .eq("feed_id", feed.value.feed_id);
  await loadFeed();
  closeMenu();
};

const handleEndFeed = async () => {
  if (!feed.value) return;
  const confirmed = window.confirm(t("确定结束这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ status: "expired", expires_at: new Date().toISOString() })
    .eq("feed_id", feed.value.feed_id);
  await loadFeed();
  closeMenu();
};

const handleDeleteFeed = async () => {
  if (!feed.value) return;
  const confirmed = window.confirm(t("确定删除这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("feed_id", feed.value.feed_id);
  closeMenu();
  handleBack();
};

const handleHideFeed = () => {
  if (!feed.value) return;
  try {
    const raw = localStorage.getItem("twsvp_feed_hidden");
    const ids = raw ? JSON.parse(raw) : [];
    const nextIds = new Set(ids);
    nextIds.add(feed.value.feed_id);
    localStorage.setItem("twsvp_feed_hidden", JSON.stringify([...nextIds]));
  } catch (error) {
    return;
  } finally {
    closeMenu();
    handleBack();
  }
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";
  await loadLikedIds();
};

const loadFeed = async () => {
  const feedId = route.params.id;
  if (!feedId || Array.isArray(feedId)) {
    return;
  }

  const numericId = Number(feedId);
  if (Number.isNaN(numericId)) {
    return;
  }

  const data = await fetchFeedByIdSupabase(numericId);
  if (!data) {
    feed.value = null;
    return;
  }

  const phase = getStatusPhase(data);
  feed.value = {
    ...data,
    statusDisplay: getStatusDisplay(data, phase),
    statusPhase: phase,
    directionLabel: mapDirectionToLabel(data.direction),
    createdLabel: formatFeedTimestamp(data.created_at),
    createdDateLabel: formatFeedTimestamp(data.created_at),
    author: data.users?.nickname || t("用户"),
    authorAvatar: data.users?.avatar_url || "",
    authorInitial: getInitials(data.users?.nickname || t("用户")),
    isAuthor: currentUserId.value && data.user_id === currentUserId.value,
    canEdit: canEditFeed(data),
    isLiked: false,
  };
  await loadLikedIds(data.feed_id);
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

onMounted(loadUser);
onMounted(loadFeed);
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
  cursor: pointer;
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

.author-name {
  font-size: 12px;
  color: var(--ink);
}

.status {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.summary {
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-wrap;
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
  color: var(--muted);
  font-size: 12px;
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
</style>
