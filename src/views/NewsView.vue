<template>
  <div class="app-shell">
    <div
      class="phone-frame fade-in"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
    >
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("资讯") }}</div>
        <router-link class="nav-btn" to="/search" :aria-label="t('搜索')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r="7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M20 20l-4-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </router-link>
        <router-link class="nav-btn" to="/notifications" :aria-label="t('通知')">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 4c-3 0-5 2.2-5 5.2v3.2l-1.6 2.4c-.4.6 0 1.2.7 1.2h11.8c.7 0 1.1-.6.7-1.2L17 12.4V9.2C17 6.2 15 4 12 4z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
            <path
              d="M10 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
          </svg>
        </router-link>
      </nav>

      <div class="refresh-indicator" :style="{ height: `${pullDistance}px` }">
        <span :class="{ active: pullDistance >= PULL_THRESHOLD }">{{ refreshLabel }}</span>
      </div>

      <section class="news-list">
        <article
          v-for="item in items"
          :key="item.article_id"
          class="news-card"
          @click="openLink(item.link)"
        >
          <h3 class="news-title">{{ item.title || "—" }}</h3>
          <p v-if="item.description" class="news-summary">{{ item.description }}</p>
          <p v-else-if="item.content" class="news-summary">{{ item.content }}</p>
          <div class="news-meta">
            <span>{{ formatTime(item.pub_date) }}</span>
            <span class="dot">·</span>
            <span>{{ formatCreator(item.creator) }}</span>
          </div>
        </article>
        <div v-if="!loading && !items.length" class="empty">
          {{ t("暂无资讯") }}
        </div>
        <div ref="loadTrigger" class="load-trigger">
          <span v-if="loading || isLoadingMore || isRefreshing">{{ t("加载中...") }}</span>
          <span v-else-if="hasMore">{{ t("下滑加载更多") }}</span>
          <span v-else>{{ t("已加载全部") }}</span>
        </div>
      </section>

      <p class="legal">
        {{ t("任何观点仅作为记录与回溯，不作为预测价格与投资建议。") }}
      </p>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import { fetchNewsSupabase } from "../services/news.js";
import { formatFeedTimestamp } from "../services/feeds.js";
import { t } from "../services/i18n.js";

const PAGE_SIZE = 20;
const PULL_THRESHOLD = 60;
const PULL_MAX = 90;

const items = ref([]);
const loading = ref(false);
const isLoadingMore = ref(false);
const isRefreshing = ref(false);
const hasMore = ref(true);
const page = ref(1);
const loadTrigger = ref(null);
const pullDistance = ref(0);
const touchStartY = ref(null);
let loadObserver = null;

const refreshLabel = computed(() => {
  if (isRefreshing.value) return t("刷新中...");
  if (pullDistance.value >= PULL_THRESHOLD) return t("松开刷新");
  return t("下拉刷新");
});

const formatCreator = (creator) => {
  if (!creator) return "—";
  if (Array.isArray(creator)) return creator.filter(Boolean).join(" ");
  return `${creator}`;
};

const formatTime = (value) => formatFeedTimestamp(value);

const openLink = (link) => {
  if (!link) return;
  window.open(link, "_blank", "noopener");
};

const loadNews = async ({ append = false } = {}) => {
  if (append) {
    isLoadingMore.value = true;
  } else {
    loading.value = true;
  }
  try {
    const rows = await fetchNewsSupabase({ page: page.value, pageSize: PAGE_SIZE });
    items.value = append ? [...items.value, ...rows] : rows;
    hasMore.value = rows.length === PAGE_SIZE;
  } catch (error) {
    console.error("Load news failed:", error);
  } finally {
    if (append) {
      isLoadingMore.value = false;
    } else {
      loading.value = false;
    }
  }
};

const refreshNews = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  page.value = 1;
  hasMore.value = true;
  await loadNews({ append: false });
  isRefreshing.value = false;
};

const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value || loading.value) return;
  page.value += 1;
  await loadNews({ append: true });
};

const handleTouchStart = (event) => {
  if (window.scrollY > 0 || loading.value || isRefreshing.value) return;
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
    await refreshNews();
  }
  pullDistance.value = 0;
  touchStartY.value = null;
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
    { rootMargin: "160px 0px" }
  );
  loadObserver.observe(loadTrigger.value);
};

onMounted(loadNews);
onMounted(async () => {
  await nextTick();
  setupInfiniteScroll();
});
onUnmounted(() => {
  if (loadObserver) {
    loadObserver.disconnect();
  }
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--background);
  color: var(--ink);
}

.phone-frame {
  width: min(600px, 100%);
  min-height: 100vh;
  background: var(--surface);
  position: relative;
  display: flex;
  flex-direction: column;
}

.nav {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px 14px;
  height: calc(64px + env(safe-area-inset-top, 0px));
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 2;
}

.nav-logo {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  overflow: hidden;
}

.nav-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nav-title {
  font-size: 18px;
  font-weight: 600;
  margin-right: auto;
  text-align: left;
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

.news-list {
  padding: 16px 16px calc(92px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.news-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.news-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.news-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--ink);
}

.news-summary {
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-meta {
  font-size: 12px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.news-meta .dot {
  font-size: 12px;
}

.load-trigger,
.empty {
  text-align: center;
  font-size: 13px;
  color: var(--muted);
  padding: 16px 0;
}

.legal {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  width: min(600px, 100%);
  text-align: left;
  font-size: 12px;
  color: var(--muted);
  padding: 6px 16px;
  margin: 0;
  line-height: 1.5;
  background: var(--bg);
  z-index: 4;
}
</style>
