<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <button class="nav-logo" type="button" :aria-label="t('刷新观点')" @click="refreshFeeds">
          <img :src="logoUrl" alt="TWSVP" />
        </button>
        <div class="nav-title">{{ t("观点") }}</div>
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
      </nav>

      <header class="slide-in">
        <div class="tabs tab-row">
          <div class="tab-group">
            <button
              class="tab-btn"
              :class="{ active: statusFilter === 'all' }"
              @click="statusFilter = 'all'"
            >
              {{ t("全部") }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: statusFilter === 'pending' }"
              @click="statusFilter = 'pending'"
            >
              {{ t("未开始") }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: statusFilter === 'active' }"
              @click="statusFilter = 'active'"
            >
              {{ t("进行中") }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: statusFilter === 'ended' }"
              @click="statusFilter = 'ended'"
            >
              {{ t("已结束") }}
            </button>
          </div>
          <div class="tab-group tab-group-right">
            <button
              class="tab-btn"
              :class="{ active: sortKey === 'time' }"
              @click="sortKey = 'time'"
            >
              {{ t("时间") }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: sortKey === 'hot' }"
              @click="sortKey = 'hot'"
            >
              {{ t("热度") }}
            </button>
          </div>
        </div>
      </header>

      <section class="feed">
        <div v-for="view in filteredViews" :key="view.feed_id" class="thread slide-in">
          <div class="thread-card" @click="goFeed(view.feed_id)">
            <div class="thread-header">
              <div class="header-left">
                <div class="stock" @click.stop="goStock(view)">
                  <span class="stock-name">{{ view.target_name }}</span>
                  <span class="stock-code">{{ view.target_symbol }}</span>
                </div>
                <span class="direction" :class="view.direction">
                  {{ view.directionLabel }}
                </span>
              </div>
              <div class="more-wrap">
                <button class="more-btn" type="button" @click.stop="toggleMenu(view.feed_id)">
                  ...
                </button>
                <div v-if="activeMenuId === view.feed_id" class="more-menu">
                  <template v-if="view.isAuthor">
                    <button
                      v-if="view.canEdit"
                      class="menu-item"
                      type="button"
                      @click.stop="handleEditFeed(view)"
                    >
                      {{ t("编辑观点") }}
                    </button>
                    <button
                      v-if="view.statusPhase !== 'ended'"
                      class="menu-item"
                      type="button"
                      @click.stop="handleEndFeed(view)"
                    >
                      {{ t("手动结束") }}
                    </button>
                    <button class="menu-item danger" type="button" @click.stop="handleDeleteFeed(view)">
                      {{ t("删除观点") }}
                    </button>
                  </template>
                  <button
                    v-else
                    class="menu-item"
                    type="button"
                    @click.stop="handleHideFeed(view)"
                  >
                    {{ t("不看这条") }}
                  </button>
                </div>
              </div>
            </div>
            <div class="thread-meta">
              <div class="author" @click.stop="goProfile(view)">
                <span class="avatar" :class="{ empty: !view.authorAvatar }">
                  <img v-if="view.authorAvatar" :src="view.authorAvatar" alt="" />
                  <span v-else>{{ view.authorInitial }}</span>
                </span>
                <span class="author-name">{{ view.author }}</span>
              </div>
              <span class="status">{{ view.statusDisplay }}</span>
            </div>
            <div class="summary" @click.stop="goFeed(view.feed_id)">{{ view.content }}</div>
            <div class="thread-footer">
              <span class="created-at">{{ view.createdDateLabel }}</span>
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
          {{ t("暂无观点，先发布一条吧。") }}
        </div>
      </section>

      <BottomTabbar />

      <p class="legal">
        {{ t("任何观点仅作为记录与回溯，不作为预测价格与投资建议。") }}
      </p>
    </div>

    <FeedEditSheet
      :open="isEditOpen"
      :feed="editingFeed"
      :saving="isEditSaving"
      @close="closeEdit"
      @save="saveEdit"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";
import FeedEditSheet from "../components/FeedEditSheet.vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";
import { t } from "../services/i18n.js";
import {
  addFeedLikeSupabase,
  fetchFeedsSupabase,
  fetchFeedLikesSupabase,
  formatFeedTimestamp,
  getRemainingDays,
  getStatusDisplay,
  getStatusPhase,
  mapDirectionToLabel,
  removeFeedLikeSupabase,
  updateFeedLikeCountSupabase,
} from "../services/feeds.js";
import { supabase } from "../services/supabase.js";

const router = useRouter();
const statusFilter = ref("all");
const sortKey = ref("time");
const user = ref({
  initials: "",
});
const feeds = ref([]);
const isLoading = ref(false);
const likedIds = ref(new Set());
const hiddenIds = ref(new Set());
const currentUserId = ref("");
const activeMenuId = ref(null);
const isEditOpen = ref(false);
const isEditSaving = ref(false);
const editingFeed = ref(null);

const filteredViews = computed(() => {
  const list = feeds.value
    .filter((view) => !hiddenIds.value.has(view.feed_id))
    .map((view) => {
      const phase = getStatusPhase(view);
      return {
        ...view,
        statusPhase: phase,
        statusDisplay: getStatusDisplay(view, phase),
        directionLabel: mapDirectionToLabel(view.direction),
        remainingDays: getRemainingDays(view),
        createdLabel: formatFeedTimestamp(view.created_at),
        createdDateLabel: formatFeedTimestamp(view.created_at),
        author: view.users?.nickname || t("用户"),
        authorAvatar: view.users?.avatar_url || "",
        authorInitial: getInitials(view.users?.nickname || t("用户")),
        isLiked: likedIds.value.has(view.feed_id),
        isAuthor: currentUserId.value && view.user_id === currentUserId.value,
        canEdit: canEditFeed(view),
      };
    });

  if (statusFilter.value === "all") return list;
  return list.filter((view) => view.statusPhase === statusFilter.value);
});

const getInitials = (name) => {
  if (!name) return "";
  return name.trim().slice(0, 1);
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  if (!supabaseUser) {
    return;
  }
  currentUserId.value = supabaseUser.id;

  const profile = await getProfileSupabase(supabaseUser.id);
  const nickname =
    profile?.nickname ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    (supabaseUser.email ? supabaseUser.email.split("@")[0] : "");

  user.value.initials = getInitials(nickname);
  await loadLikedIds();
};

const canEditFeed = (view) => {
  if (!currentUserId.value || view.user_id !== currentUserId.value) {
    return false;
  }
  const createdAt = new Date(view.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 10 * 60 * 1000;
};

const loadLikedIds = async (list = feeds.value) => {
  if (!currentUserId.value) {
    likedIds.value = new Set();
    return;
  }
  const feedIds = list.map((view) => view.feed_id);
  likedIds.value = await fetchFeedLikesSupabase(currentUserId.value, feedIds);
};

const loadFeeds = async () => {
  isLoading.value = true;
  const data = await fetchFeedsSupabase({
    status: "all",
    sort: sortKey.value,
  });
  feeds.value = data;
  await loadLikedIds(data);
  isLoading.value = false;
};

const refreshFeeds = async () => {
  await loadFeeds();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const loadHiddenIds = () => {
  try {
    const raw = localStorage.getItem("twsvp_feed_hidden");
    const ids = raw ? JSON.parse(raw) : [];
    hiddenIds.value = new Set(ids);
  } catch (error) {
    hiddenIds.value = new Set();
  }
};

const saveHiddenIds = () => {
  localStorage.setItem("twsvp_feed_hidden", JSON.stringify([...hiddenIds.value]));
};

const toggleMenu = (feedId) => {
  activeMenuId.value = activeMenuId.value === feedId ? null : feedId;
};

const closeMenu = () => {
  activeMenuId.value = null;
};

const handleHideFeed = (view) => {
  hiddenIds.value.add(view.feed_id);
  saveHiddenIds();
  closeMenu();
};

const handleDeleteFeed = async (view) => {
  const confirmed = window.confirm(t("确定删除这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  feeds.value = feeds.value.filter((item) => item.feed_id !== view.feed_id);
  closeMenu();
};

const handleEndFeed = async (view) => {
  const confirmed = window.confirm(t("确定结束这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ status: "expired", expires_at: new Date().toISOString() })
    .eq("feed_id", view.feed_id);
  await loadFeeds();
  closeMenu();
};

const handleEditFeed = async (view) => {
  editingFeed.value = { ...view };
  isEditOpen.value = true;
  closeMenu();
};

const closeEdit = () => {
  isEditOpen.value = false;
  editingFeed.value = null;
};

const saveEdit = async (content) => {
  if (!editingFeed.value) return;
  const nextContent = content.trim();
  if (!nextContent) return;
  isEditSaving.value = true;
  await supabase
    .from("feeds")
    .update({ content: nextContent })
    .eq("feed_id", editingFeed.value.feed_id);
  await loadFeeds();
  isEditSaving.value = false;
  closeEdit();
};

const toggleLike = async (view) => {
  if (!currentUserId.value) {
    router.replace("/login");
    return;
  }
  const alreadyLiked = likedIds.value.has(view.feed_id);
  const delta = alreadyLiked ? -1 : 1;
  const nextCount = Math.max(0, (view.like_count || 0) + delta);
  view.like_count = nextCount;
  view.isLiked = !alreadyLiked;
  const feedIndex = feeds.value.findIndex((item) => item.feed_id === view.feed_id);
  if (feedIndex !== -1) {
    feeds.value[feedIndex] = {
      ...feeds.value[feedIndex],
      like_count: nextCount,
    };
  }
  if (alreadyLiked) {
    const nextIds = new Set(likedIds.value);
    nextIds.delete(view.feed_id);
    likedIds.value = nextIds;
  } else {
    const nextIds = new Set(likedIds.value);
    nextIds.add(view.feed_id);
    likedIds.value = nextIds;
  }
  const ok = alreadyLiked
    ? await removeFeedLikeSupabase(currentUserId.value, view.feed_id)
    : await addFeedLikeSupabase(currentUserId.value, view.feed_id);
  if (ok) {
    await updateFeedLikeCountSupabase(view.feed_id, delta);
  } else {
    const revertCount = Math.max(0, (view.like_count || 0) - delta);
    view.like_count = revertCount;
    view.isLiked = alreadyLiked;
    if (feedIndex !== -1) {
      feeds.value[feedIndex] = {
        ...feeds.value[feedIndex],
        like_count: revertCount,
      };
    }
    await loadLikedIds();
  }
};

const goFeed = (feedId) => {
  router.push(`/feed/${feedId}`);
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
onMounted(loadFeeds);
onMounted(loadHiddenIds);
watch([statusFilter, sortKey], loadFeeds);
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
  padding: 76px 16px 140px;
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

.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-top: 6px;
}

.tab-row {
  align-items: center;
  justify-content: space-between;
}

.tab-group {
  display: inline-flex;
  gap: 16px;
  align-items: center;
}

.tab-group-right {
  margin-left: auto;
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
  gap: 8px;
  cursor: pointer;
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.thread-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.stock-name {
  font-size: 14px;
  font-weight: 600;
}

.stock-code {
  font-size: 12px;
  color: var(--muted);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
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
  display: block;
}

.author-name {
  font-size: 12px;
  color: var(--ink);
}

.status {
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

.created-at {
  font-size: 12px;
  color: var(--muted);
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
    padding: 68px 16px 140px;
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
