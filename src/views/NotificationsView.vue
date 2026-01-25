<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">通知</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'like' }"
          @click="activeTab = 'like'"
        >
          点赞
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'share' }"
          @click="activeTab = 'share'"
        >
          分享
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'expire' }"
          @click="activeTab = 'expire'"
        >
          到期提醒
        </button>
      </div>

      <section class="list">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="item"
          @click="goFeed(item.feedId)"
        >
          <div class="item-main">
            <button
              v-if="item.actorId"
              class="avatar"
              type="button"
              @click.stop="goProfile(item)"
            >
              <img v-if="item.actorAvatar" :src="item.actorAvatar" alt="" />
              <span v-else>{{ item.actorInitial }}</span>
            </button>
            <div v-else class="avatar system">系</div>
            <div class="item-body">
              <strong>{{ item.title }}</strong>
              <span class="detail">{{ item.detail }}</span>
              <span v-if="item.summary" class="summary">{{ item.summary }}</span>
              <span class="meta">{{ item.time }}</span>
            </div>
          </div>
        </div>
        <div v-if="!isLoading && !filteredItems.length" class="empty">暂无通知</div>
      </section>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import { fetchNotificationsSupabase } from "../services/notifications.js";

const router = useRouter();
const activeTab = ref("like");
const items = ref([]);
const isLoading = ref(false);
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

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const getDaysLeft = (expiresAt) => {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
};

const buildItem = (row) => {
  const feed = row.feeds || {};
  const actor = row.actor || {};
  const actorName = actor.nickname || "用户";
  const targetLabel = [feed.target_symbol, feed.target_name].filter(Boolean).join(" ");
  const summary = feed.summary || feed.content || "";
  const daysLeft = getDaysLeft(feed.expires_at);
  let title = "通知";
  let detail = "";
  let tab = row.type || "";

  if (row.type === "like") {
    title = "有人点赞了你的观点";
    detail = `${actorName}点赞了${targetLabel ? `「${targetLabel}」` : "你的观点"}`;
  } else if (row.type === "bookmark") {
    title = "观点被收藏";
    detail = `${actorName}收藏了${targetLabel ? `「${targetLabel}」` : "你的观点"}`;
    tab = "like";
  } else if (row.type === "share") {
    title = "观点被分享";
    detail = `${actorName}分享了${targetLabel ? `「${targetLabel}」` : "你的观点"}`;
  } else if (row.type === "expire_soon") {
    title = "观点即将到期";
    const suffix = daysLeft !== null ? `将在 ${daysLeft} 天后到期` : "即将到期";
    detail = `你的观点${targetLabel ? `「${targetLabel}」` : ""}${suffix}`;
    tab = "expire";
  } else if (row.type === "expired") {
    title = "观点已到期";
    detail = `你的观点${targetLabel ? `「${targetLabel}」` : ""}已到期`;
    tab = "expire";
  }

  return {
    id: row.noti_id,
    type: tab,
    feedId: row.target_feed_id || feed.feed_id,
    title,
    detail,
    summary,
    time: formatDateTime(row.created_at),
    actorId: row.actor_user_id,
    actor: actorName,
    actorAvatar: actor.avatar_url || "",
    actorInitial: getInitials(actorName),
  };
};

const filteredItems = computed(() => {
  if (activeTab.value === "expire") {
    return items.value.filter((item) => item.type === "expire");
  }
  return items.value.filter((item) => item.type === activeTab.value);
});

const loadNotifications = async () => {
  const user = await getCurrentUserSupabase();
  if (!user) {
    router.replace("/login");
    return;
  }
  currentUserId.value = user.id;
  isLoading.value = true;
  const rows = await fetchNotificationsSupabase(user.id);
  items.value = rows.filter((row) => row.feeds && !row.feeds.deleted_at).map(buildItem);
  isLoading.value = false;
};

const goFeed = (feedId) => {
  if (!feedId) return;
  router.push(`/feed/${feedId}`);
};

const goProfile = (item) => {
  const userId = item?.actorId;
  if (!userId) return;
  if (currentUserId.value && userId === currentUserId.value) {
    router.push("/profile");
  } else {
    router.push(`/user/${userId}`);
  }
};

onMounted(loadNotifications);
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

.nav-space {
  width: 32px;
}

.tabs {
  margin: 8px 0 12px;
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

.list {
  display: grid;
  gap: 12px;
}

.item {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 12px 14px;
  background: var(--surface);
  cursor: pointer;
}

.item-main {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.item-body {
  display: grid;
  gap: 4px;
}

.item-body span {
  font-size: 12px;
  color: var(--muted);
}

.detail {
  color: var(--muted);
}

.summary {
  color: var(--ink);
}

.meta {
  margin-top: 4px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  background: var(--panel);
  overflow: hidden;
  padding: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar.system {
  background: var(--surface);
  color: var(--muted);
}

.empty {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}
</style>
