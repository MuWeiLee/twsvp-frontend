<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">返回</router-link>
        <div class="nav-title">个人主页</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="profile">
        <div class="user-card">
          <div class="avatar">{{ user.initials }}</div>
          <div>
            <div class="name">{{ user.name }}</div>
            <div class="meta">{{ user.bio }}</div>
            <div class="tags">
              <span v-for="tag in user.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <div class="meta">加入于 {{ user.joined }}</div>
          </div>
        </div>

        <div class="stats">
          <div>
            <div class="stat-label">观点总数</div>
            <div class="stat-value">{{ stats.totalViews }}</div>
          </div>
          <div>
            <div class="stat-label">已结束</div>
            <div class="stat-value">{{ stats.closedViews }}</div>
          </div>
          <div>
            <div class="stat-label">胜率</div>
            <div class="stat-value">{{ stats.winRate }}</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: mode === 'all' }"
            @click="mode = 'all'"
          >
            全部
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'pending' }"
            @click="mode = 'pending'"
          >
            未结束
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'active' }"
            @click="mode = 'active'"
          >
            进行中
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'ended' }"
            @click="mode = 'ended'"
          >
            已结束
          </button>
        </div>

        <div class="view-list">
          <div
            v-for="view in filteredViews"
            :key="view.feed_id"
            class="view-item"
            @click="goFeed(view.feed_id)"
          >
            <div class="thread-body">
              <div class="view-header" @click.stop="goStock(view)">
                <span>{{ view.target_symbol }} {{ view.target_name }}</span>
                <span class="status">{{ view.statusLabel }}</span>
              </div>
              <div class="view-meta">
                <span class="direction">{{ view.directionLabel }}</span>
                <span>剩余 {{ view.remainingDays }} 天</span>
                <span>发布于 {{ view.createdLabel }}</span>
              </div>
              <div class="summary" @click.stop="goStock(view)">{{ view.content }}</div>
            </div>
          </div>
        </div>
        <div v-if="!filteredViews.length" class="empty">暂无观点</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getProfileSupabase, getUserGroupNamesSupabase } from "../services/profile.js";
import {
  fetchFeedsSupabase,
  getRemainingDays,
  getStatusLabel,
  getStatusPhase,
  mapDirectionToLabel,
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
    return {
      ...view,
      statusPhase: phase,
      statusLabel: getStatusLabel(phase),
      directionLabel: mapDirectionToLabel(view.direction),
      createdLabel: formatDate(view.created_at),
      remainingDays: getRemainingDays(view),
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
    winRate: totalViews ? "待结算" : "—",
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

  const [profile, tags] = await Promise.all([
    getProfileSupabase(userId),
    getUserGroupNamesSupabase(userId),
  ]);

  const nickname = profile?.nickname || "用户";

  user.value = {
    initials: getInitials(nickname),
    name: nickname,
    bio: profile?.bio || "尚未填写简介",
    tags,
    joined: formatDate(profile?.created_at),
  };

  const data = await fetchFeedsSupabase({ userId });
  feeds.value = data;
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

onMounted(loadProfile);
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

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--panel);
  display: grid;
  place-items: center;
  font-weight: 600;
}

.name {
  font-weight: 600;
}

.meta {
  font-size: 12px;
  color: var(--muted);
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

.thread-body {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.view-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--border);
}

.direction {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
  color: var(--ink);
}

.status {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
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

.empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
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
