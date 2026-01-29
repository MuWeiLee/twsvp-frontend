<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("通知") }}</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <div class="tabs tabs-wrap" :class="{ hidden: !showTabs }">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'like' }"
          @click="activeTab = 'like'"
        >
          {{ t("点赞") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'comment' }"
          @click="activeTab = 'comment'"
        >
          {{ t("留言") }}
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'expire' }"
          @click="activeTab = 'expire'"
        >
          {{ t("到期提醒") }}
        </button>
      </div>

      <div
        ref="scrollContainer"
        class="notifications-scroll"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
      >
        <div class="refresh-indicator" :style="{ height: `${pullDistance}px` }">
          <span :class="{ active: pullDistance >= PULL_THRESHOLD }">{{ refreshLabel }}</span>
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
              <div v-else class="avatar system">{{ t("系") }}</div>
              <div class="item-body">
                <span class="notice">{{ item.title }}</span>
                <strong v-if="item.stockLabel" class="stock-title">{{ item.stockLabel }}</strong>
                <span v-if="item.summary" class="summary">{{ item.summary }}</span>
                <span class="meta">{{ item.time }}</span>
              </div>
            </div>
          </div>
          <div v-if="!isLoading && !filteredItems.length" class="empty">
            {{ t("暂无通知") }}
          </div>
          <div ref="loadTrigger" class="load-trigger">
            <span v-if="isLoading || isLoadingMore">{{ t("加载中...") }}</span>
            <span v-else-if="hasMore">{{ t("下滑加载更多") }}</span>
            <span v-else>{{ t("已加载全部") }}</span>
          </div>
        </section>
      </div>

      <p class="legal">
        {{ t("任何观点仅作为记录与回溯，不作为预测价格与投资建议。") }}
      </p>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import { fetchNotificationsSupabase } from "../services/notifications.js";
import { formatFeedTimestamp } from "../services/feeds.js";
import { t } from "../services/i18n.js";

const router = useRouter();
const activeTab = ref("like");
const items = ref([]);
const isLoading = ref(false);
const currentUserId = ref("");
const showTabs = ref(true);
const lastScrollY = ref(0);
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const PAGE_SIZE = 20;
const PULL_THRESHOLD = 60;
const PULL_MAX = 90;
const isRefreshing = ref(false);
const loadTrigger = ref(null);
const scrollContainer = ref(null);
const pullDistance = ref(0);
const touchStartY = ref(null);
let loadObserver = null;

const refreshLabel = computed(() => {
  if (isRefreshing.value) return t("刷新中...");
  if (pullDistance.value >= PULL_THRESHOLD) return t("松开刷新");
  return t("下拉刷新");
});

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
  const actorName = actor.nickname || t("用户");
  const targetLabel = [feed.target_symbol, feed.target_name].filter(Boolean).join(" ");
  let summary = feed.summary || feed.content || "";
  const daysLeft = getDaysLeft(feed.expires_at);
  let title = row.title || t("通知");
  let detail = row.detail || "";
  let tab = row.type || "";

  if (row.type === "like") {
    const likeCount = Number(feed.like_count || 0);
    const others = Math.max(0, likeCount - 1);
    title =
      others > 0
        ? t("{actorName} 与另外 {others} 个人点赞了你的观点。", {
            actorName,
            others,
          })
        : t("{actorName} 点赞了你的观点。", { actorName });
    detail = row.detail || "";
  } else if (row.type === "bookmark") {
    if (!row.title) {
      title = t("观点被收藏");
    }
    if (!row.detail) {
      detail = t("{actorName}收藏了{target}", {
        actorName,
        target: targetLabel ? `「${targetLabel}」` : t("你的观点"),
      });
    }
    tab = "like";
  } else if (row.type === "comment" || row.type === "reply") {
    if (!row.title) {
      title = t("{actorName}在你的观点下留言", { actorName });
    }
    detail =
      row.detail ||
      row.comment_content ||
      row.comment ||
      row.content ||
      "";
    if (!detail) {
      detail = t("未填写留言内容");
    }
    summary = detail || summary;
    tab = "comment";
  } else if (row.type === "share") {
    if (!row.title) {
      title = t("观点被分享");
    }
    if (!row.detail) {
      detail = t("{actorName}分享了{target}", {
        actorName,
        target: targetLabel ? `「${targetLabel}」` : t("你的观点"),
      });
    }
  } else if (row.type === "expire_soon") {
    const suffix =
      daysLeft !== null
        ? t("将在 {days} 天后到期", { days: daysLeft })
        : t("即将到期");
    if (!row.title) {
      title = t("观点即将到期");
    }
    if (!row.detail) {
      detail = t("你的观点{target}{suffix}", {
        target: targetLabel ? `「${targetLabel}」` : "",
        suffix,
      });
    }
    tab = "expire";
  } else if (row.type === "expired") {
    if (!row.title) {
      title = t("观点已到期");
    }
    if (!row.detail) {
      detail = t("你的观点{target}已到期", {
        target: targetLabel ? `「${targetLabel}」` : "",
      });
    }
    tab = "expire";
  }

  const stockLabel =
    tab === "comment" ? "" : [feed.target_name, feed.target_symbol].filter(Boolean).join(" ");

  return {
    id: row.noti_id,
    type: tab,
    feedId: row.target_feed_id || feed.feed_id,
    title,
    detail,
    stockLabel,
    summary,
    time: formatFeedTimestamp(row.created_at),
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

const loadNotifications = async ({ append = false } = {}) => {
  const user = await getCurrentUserSupabase();
  if (!user) {
    router.replace("/login");
    return;
  }
  currentUserId.value = user.id;
  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
  }
  const rows = await fetchNotificationsSupabase(user.id, {
    page: page.value,
    pageSize: PAGE_SIZE,
  });
  const nextItems = rows
    .filter((row) => row.type !== "share")
    .filter((row) => !row.feeds || !row.feeds.deleted_at)
    .map(buildItem);
  items.value = append ? [...items.value, ...nextItems] : nextItems;
  hasMore.value = rows.length === PAGE_SIZE;
  if (append) {
    isLoadingMore.value = false;
  } else {
    isLoading.value = false;
  }
};

const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) return;
  page.value += 1;
  await loadNotifications({ append: true });
};

const refreshNotifications = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  page.value = 1;
  hasMore.value = true;
  await loadNotifications({ append: false });
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({ top: 0, behavior: "smooth" });
  }
  isRefreshing.value = false;
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
    await refreshNotifications();
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

onMounted(loadNotifications);
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
watch(activeTab, () => {
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
  --nav-height: 64px;
  --tabs-height: 52px;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  position: relative;
  display: flex;
  flex-direction: column;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: calc(64px + env(safe-area-inset-top, 0px));
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
  margin-left: auto;
}

.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-top: 6px;
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

.notifications-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: calc(var(--nav-height) + var(--tabs-height) + env(safe-area-inset-top, 0px)) 16px
    calc(96px + env(safe-area-inset-bottom, 0px));
  overscroll-behavior: contain;
  background: var(--bg);
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

.list {
  display: grid;
  gap: 8px;
  padding-top: 72px;
}

.item {
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 8px 10px;
  background: #fff;
  cursor: pointer;
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

.item-main {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.item-body {
  display: grid;
  gap: 2px;
}

.notice {
  font-size: 12px;
  color: var(--muted);
}

.stock-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.summary {
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  aspect-ratio: 1 / 1;
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
  flex-shrink: 0;
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
  .notifications-scroll {
    padding: 68px 16px 140px;
  }
}
</style>
