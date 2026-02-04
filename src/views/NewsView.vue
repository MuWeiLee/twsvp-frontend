<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">
          <img :src="logoUrl" alt="TWSVP" />
        </router-link>
        <div class="nav-title">{{ t("挖掘") }}</div>
        <router-link class="nav-btn" to="/search" :aria-label="t('搜索')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
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

      <header class="tabs-wrap" :class="{ hidden: !showTabs }">
        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'news' }"
            @click="activeTab = 'news'"
          >
            {{ t("资讯") }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'strategy' }"
            @click="activeTab = 'strategy'"
          >
            {{ t("策略") }}
          </button>
        </div>
      </header>

      <div
        ref="scrollContainer"
        class="feed-scroll"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
      >
        <div class="refresh-indicator" :style="{ height: `${pullDistance}px` }">
          <span :class="{ active: pullDistance >= PULL_THRESHOLD }">{{ refreshLabel }}</span>
        </div>
        <section v-if="activeTab === 'news'" class="news-list">
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

        <section v-else class="strategy-placeholder">
          <div class="empty">{{ t("修复中，敬请期待") }}</div>
        </section>
      </div>

      <BottomTabbar />
      <p class="legal">
        {{ t("任何觀點僅作為記錄與回溯，不作為預測價格與投資建議。") }}
      </p>
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
 

const activeTab = ref("news");
const showTabs = ref(true);
const lastScrollY = ref(0);

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
const scrollContainer = ref(null);
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
  if (loading.value || isRefreshing.value) return;
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
    { root: scrollContainer.value, rootMargin: "160px 0px" }
  );
  loadObserver.observe(loadTrigger.value);
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

onMounted(async () => {
  await loadNews({ append: false });
  await nextTick();
  setupInfiniteScroll();
  if (scrollContainer.value) {
    lastScrollY.value = scrollContainer.value.scrollTop || 0;
    scrollContainer.value.addEventListener("scroll", handleScroll, { passive: true });
  }
});

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener("scroll", handleScroll);
  }
  if (loadObserver) loadObserver.disconnect();
});
</script>

<style scoped>
.app-shell {
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg);
  min-height: 100vh;
  height: 100vh;
  --nav-height: 64px;
  --tabs-height: 44px;
  --header-gap: 0px;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: calc(var(--nav-height) + env(safe-area-inset-top, 0px));
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
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  text-decoration: none;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
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

.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-top: 6px;
  align-items: center;
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

.feed-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: calc(var(--nav-height) + var(--tabs-height) + var(--header-gap) + env(safe-area-inset-top, 0px))
    16px
    calc(140px + env(safe-area-inset-bottom, 0px));
  overscroll-behavior: contain;
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

.news-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.news-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 12px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.news-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.45;
}

.news-summary {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
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

.dot {
  font-size: 10px;
}

 
.strategy-placeholder {
  padding: 24px 0 32px;
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
  text-align: left;
  background: var(--bg);
  z-index: 4;
}

.empty {
  text-align: center;
  color: var(--muted);
  padding: 24px 0 32px;
}
</style>
