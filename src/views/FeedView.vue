<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <button class="nav-logo" type="button" aria-label="刷新观点" @click="refreshFeeds">
          <img :src="logoUrl" alt="TWSVP" />
        </button>
        <div class="nav-title">观点</div>
        <router-link class="nav-btn" to="/search">搜索</router-link>
      </nav>

      <header class="slide-in">
        <div class="filter-row">
          <div class="filter-group">
            <button
              class="filter-btn"
              :class="{ active: statusFilter === 'all' }"
              @click="statusFilter = 'all'"
            >
              全部
            </button>
            <span class="divider">|</span>
            <button
              class="filter-btn"
              :class="{ active: statusFilter === 'active' }"
              @click="statusFilter = 'active'"
            >
              未结束
            </button>
            <span class="divider">|</span>
            <button
              class="filter-btn"
              :class="{ active: statusFilter === 'expired' }"
              @click="statusFilter = 'expired'"
            >
              已结束
            </button>
          </div>
          <div class="filter-group">
            <button
              class="filter-btn"
              :class="{ active: sortKey === 'time' }"
              @click="sortKey = 'time'"
            >
              时间
            </button>
            <span class="divider">|</span>
            <button
              class="filter-btn"
              :class="{ active: sortKey === 'hot' }"
              @click="sortKey = 'hot'"
            >
              热度
            </button>
          </div>
        </div>
      </header>

      <section class="feed">
        <div v-for="view in filteredViews" :key="view.feed_id" class="thread slide-in">
          <div class="thread-card" @click="goFeed(view.feed_id)">
            <div class="thread-header">
              <div class="stock">
                <strong>{{ view.target_symbol }}</strong>
                <span>{{ view.target_name }}</span>
              </div>
              <div class="header-meta">
                <span class="pill">{{ view.directionLabel }}</span>
                <span class="pill status">{{ view.statusLabel }}</span>
                <span class="remain">还有: {{ view.remainingDays }} 天</span>
                <button class="more-btn" type="button" @click.stop>更多</button>
              </div>
            </div>
            <div class="thread-sub">
              <span>{{ view.author }}</span>
              <span>{{ view.createdLabel }}</span>
            </div>
            <div class="summary">{{ view.content }}</div>
            <div class="thread-footer">
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
        <div v-if="!isLoading && !filteredViews.length" class="empty">
          暂无观点，先发布一条吧。
        </div>
      </section>

      <p class="legal">
        广场仅展示观点记录与回溯，不构成任何投资建议。
      </p>

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
import {
  fetchFeedsSupabase,
  mapDirectionToLabel,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";

const router = useRouter();
const statusFilter = ref("all");
const sortKey = ref("time");
const user = ref({
  initials: "",
});
const feeds = ref([]);
const isLoading = ref(false);
const likedIds = ref(new Set());

const filteredViews = computed(() =>
  feeds.value.map((view) => ({
    ...view,
    statusLabel: getStatusLabel(view),
    directionLabel: mapDirectionToLabel(view.direction),
    remainingDays: getRemainingDays(view.expires_at),
    createdLabel: formatDateTime(view.created_at),
    author: view.users?.nickname || "用户",
    isLiked: likedIds.value.has(view.feed_id),
  }))
);

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  if (!supabaseUser) {
    return;
  }

  const profile = await getProfileSupabase(supabaseUser.id);
  const nickname =
    profile?.nickname ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    (supabaseUser.email ? supabaseUser.email.split("@")[0] : "");

  user.value.initials = getInitials(nickname);
};

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

const getStatusLabel = (view) => {
  if (view.status === "verified") return "已验证";
  if (view.status === "expired") return "已结束";
  const remaining = getRemainingDays(view.expires_at);
  return remaining === 0 ? "已结束" : "未结束";
};

const getRemainingDays = (value) => {
  if (!value) return 0;
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return 0;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

const loadFeeds = async () => {
  isLoading.value = true;
  const data = await fetchFeedsSupabase({
    status: statusFilter.value,
    sort: sortKey.value,
  });
  feeds.value = data;
  isLoading.value = false;
};

const refreshFeeds = async () => {
  await loadFeeds();
  window.scrollTo({ top: 0, behavior: "smooth" });
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

const toggleLike = async (view) => {
  const alreadyLiked = likedIds.value.has(view.feed_id);
  const delta = alreadyLiked ? -1 : 1;
  const nextCount = Math.max(0, (view.like_count || 0) + delta);
  view.like_count = nextCount;
  if (alreadyLiked) {
    likedIds.value.delete(view.feed_id);
  } else {
    likedIds.value.add(view.feed_id);
  }
  saveLikedIds();
  await updateFeedLikeCountSupabase(view.feed_id, delta);
};

const goFeed = (feedId) => {
  router.push(`/feed/${feedId}`);
};

onMounted(loadUser);
onMounted(loadFeeds);
onMounted(loadLikedIds);
watch([statusFilter, sortKey], loadFeeds);
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
  font-weight: 500;
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
  cursor: pointer;
}

.nav-logo img {
  width: 28px;
  height: 28px;
  display: block;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding: 4px 0 2px;
  color: var(--ink);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-btn {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
  padding: 0;
}

.filter-btn.active {
  text-decoration: underline;
}

.divider {
  color: var(--muted);
}

.feed {
  margin-top: 18px;
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
  gap: 10px;
  cursor: pointer;
}

.thread-header {
  display: grid;
  gap: 8px;
}

.thread-footer {
  display: flex;
  justify-content: flex-end;
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
  padding: 0;
  border-radius: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
}

.pill.status {
  color: var(--muted);
}

.remain {
  color: var(--muted);
}

.more-btn {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
}

.thread-sub {
  display: flex;
  justify-content: space-between;
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

.summary {
  color: var(--ink);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.legal {
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
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
  .phone-frame {
    padding: 68px 16px 88px;
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
