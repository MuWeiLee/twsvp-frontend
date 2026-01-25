<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">观点详情</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="thread-card detail" v-if="feed">
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
        <div class="summary full">{{ feed.content }}</div>
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
      <section v-else class="thread-card detail empty">暂无该观点。</section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import {
  addFeedLikeSupabase,
  fetchFeedByIdSupabase,
  fetchFeedLikesSupabase,
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

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
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
    directionLabel: mapDirectionToLabel(data.direction),
    createdLabel: formatDateTime(data.created_at),
    createdDateLabel: formatDate(data.created_at),
    author: data.users?.nickname || "用户",
    authorAvatar: data.users?.avatar_url || "",
    authorInitial: getInitials(data.users?.nickname || "用户"),
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

onMounted(loadUser);
onMounted(loadFeed);
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

.thread-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.thread-card.detail {
  padding: 16px;
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

.summary {
  line-height: 1.6;
  color: var(--ink);
  white-space: pre-line;
}

.summary.full {
  display: block;
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
</style>
