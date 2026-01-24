<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">个人中心</div>
        <button class="nav-btn" @click="goSettings">设置</button>
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
            <div class="stat-value">{{ performance.totalViews }}</div>
          </div>
          <div>
            <div class="stat-label">已结束</div>
            <div class="stat-value">{{ performance.closedViews }}</div>
          </div>
          <div>
            <div class="stat-label">胜率</div>
            <div class="stat-value">{{ performance.winRate }}</div>
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
            :class="{ active: mode === 'active' }"
            @click="mode = 'active'"
          >
            未结束
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'closed' }"
            @click="mode = 'closed'"
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
            <div class="thread-dot" aria-hidden="true"></div>
            <div class="thread-body">
              <div class="view-header">
                <span>{{ view.target_symbol }} {{ view.target_name }}</span>
                <span class="status">{{ view.statusLabel }}</span>
              </div>
              <div class="view-meta">
                <span class="direction">{{ view.directionLabel }}</span>
                <span>剩余 {{ view.remainingDays }} 天</span>
                <span>发布于 {{ view.createdLabel }}</span>
              </div>
              <div class="summary">{{ view.content }}</div>
            </div>
          </div>
        </div>
        <div v-if="!filteredViews.length" class="empty">暂无观点</div>

        <p class="legal">
          仅记录观点与回溯结果，不展示预测价格，也不作为投资建议。
        </p>
      </section>

      <nav class="tabbar">
        <router-link class="tab-item" active-class="active" to="/feed">观点流</router-link>
        <router-link class="tab-item" active-class="active" to="/search">搜索</router-link>
        <router-link class="tab-item" active-class="active" to="/create-feed">发布</router-link>
        <router-link class="tab-item" active-class="active" to="/notifications">通知</router-link>
        <router-link class="tab-item" active-class="active" to="/profile">个人中心</router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import logoUrl from "../assets/logo.png";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase, getUserGroupNamesSupabase } from "../services/profile.js";
import { fetchFeedsSupabase, mapDirectionToLabel } from "../services/feeds.js";

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

const getRemainingDays = (value) => {
  if (!value) return 0;
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return 0;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const performance = computed(() => {
  const totalViews = feeds.value.length;
  const closedViews = feeds.value.filter((view) => view.status !== "active").length;
  return {
    totalViews,
    closedViews,
    winRate: totalViews ? "待结算" : "—",
  };
});

const filteredViews = computed(() => {
  const filtered = feeds.value.filter((view) => {
    if (mode.value === "all") return true;
    if (mode.value === "active") return view.status === "active";
    return view.status !== "active";
  });
  return filtered.map((view) => ({
    ...view,
    statusLabel: view.status === "active" ? "未结束" : "已结束",
    directionLabel: mapDirectionToLabel(view.direction),
    createdLabel: formatDate(view.created_at),
    remainingDays: getRemainingDays(view.expires_at),
  }));
});

const loadProfile = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  if (!supabaseUser) {
    router.replace("/login");
    return;
  }

  const [profile, tags] = await Promise.all([
    getProfileSupabase(supabaseUser.id),
    getUserGroupNamesSupabase(supabaseUser.id),
  ]);

  const nickname =
    profile?.nickname ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    (supabaseUser.email ? supabaseUser.email.split("@")[0] : "用户");

  user.value = {
    initials: getInitials(nickname),
    name: nickname,
    bio: profile?.bio || "尚未填写简介",
    tags,
    joined: formatDate(profile?.created_at || supabaseUser.created_at),
  };

  const data = await fetchFeedsSupabase({ userId: supabaseUser.id });
  feeds.value = data;
};

const goFeed = (feedId) => {
  router.push(`/feed/${feedId}`);
};

const goSettings = () => {
  router.push("/settings");
};

onMounted(loadProfile);
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
  padding: 72px 20px 96px;
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
  border-radius: 8px;
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  text-decoration: none;
}

.nav-logo img {
  width: 18px;
  height: 18px;
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
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
  cursor: pointer;
}

.thread-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ink);
  margin-top: 8px;
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

.legal {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  bottom: 0;
  margin-top: 0;
  min-height: 56px;
  padding: 10px 6px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 5;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
}

.tab-item {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  display: block;
  width: 100%;
}

.tab-item.active {
  color: var(--ink);
  font-weight: 600;
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
