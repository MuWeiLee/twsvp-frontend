<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">观点详情</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="card" v-if="feed">
        <div class="header">
          <div class="stock">
            <strong>{{ feed.target_symbol }}</strong>
            <span>{{ feed.target_name }}</span>
          </div>
          <div class="header-meta">
            <span class="pill">{{ feed.directionLabel }}</span>
            <span class="pill status">{{ feed.statusLabel }}</span>
            <span class="remain">还有: {{ feed.remainingDays }} 天</span>
            <button class="more-btn" type="button">更多</button>
          </div>
        </div>
        <div class="sub">
          <span>{{ feed.author }}</span>
          <span>{{ feed.createdLabel }}</span>
        </div>
        <p class="content">{{ feed.content }}</p>
        <div class="footer">
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
      <section v-else class="card empty">暂无该观点。</section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  fetchFeedByIdSupabase,
  mapDirectionToLabel,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";

const route = useRoute();
const feed = ref(null);
const likedIds = ref(new Set());

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

const getRemainingDays = (value) => {
  if (!value) return 0;
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return 0;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

const getStatusLabel = (value) => {
  if (value === "verified") return "已验证";
  if (value === "expired") return "已结束";
  return "未结束";
};

const loadLikedIds = () => {
  try {
    const raw = localStorage.getItem("twsvp_feed_likes");
    const ids = raw ? JSON.parse(raw) : [];
    likedIds.value = new Set(ids);
  } catch (error) {
    likedIds.value = new Set();
  }
};

const saveLikedIds = () => {
  localStorage.setItem("twsvp_feed_likes", JSON.stringify([...likedIds.value]));
};

const toggleLike = async () => {
  if (!feed.value) return;
  const alreadyLiked = likedIds.value.has(feed.value.feed_id);
  const delta = alreadyLiked ? -1 : 1;
  const nextCount = Math.max(0, (feed.value.like_count || 0) + delta);
  feed.value.like_count = nextCount;
  feed.value.isLiked = !alreadyLiked;
  if (alreadyLiked) {
    likedIds.value.delete(feed.value.feed_id);
  } else {
    likedIds.value.add(feed.value.feed_id);
  }
  saveLikedIds();
  await updateFeedLikeCountSupabase(feed.value.feed_id, delta);
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

  feed.value = {
    ...data,
    statusLabel: getStatusLabel(data.status),
    directionLabel: mapDirectionToLabel(data.direction),
    remainingDays: getRemainingDays(data.expires_at),
    createdLabel: formatDateTime(data.created_at),
    author: data.users?.nickname || "用户",
    isLiked: likedIds.value.has(data.feed_id),
  };
};

onMounted(loadLikedIds);
onMounted(loadFeed);
</script>

<style scoped>
.app-shell {
  max-width: 480px;
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
  padding: 72px 20px 40px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
}

.nav-title {
  font-weight: 700;
  font-size: 15px;
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
  width: 28px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 18px;
  border: 1px solid var(--border);
  display: grid;
  gap: 12px;
}

.header {
  display: grid;
  gap: 8px;
}

.stock {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-weight: 600;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.pill {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--ink);
}

.pill.status {
  color: var(--muted);
}

.remain {
  color: var(--muted);
}

.more-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}

.sub {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}

.content {
  margin: 0;
  line-height: 1.6;
  color: var(--ink);
}

.footer {
  display: flex;
  justify-content: flex-end;
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
