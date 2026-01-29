<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <button class="nav-btn" type="button" :aria-label="t('返回')" @click="handleBack">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div class="nav-title">{{ t("观点详情") }}</div>
        <button class="nav-btn" type="button" :aria-label="t('分享')" @click="handleShare">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 17l10-10M10 7h7v7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </nav>

      <section class="thread-card" v-if="feed">
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
          <div class="more-wrap">
            <button class="more-btn" type="button" @click.stop="toggleMenu">...</button>
            <div v-if="menuOpen" class="more-menu">
              <template v-if="feed.isAuthor">
                <button
                  v-if="feed.canEdit"
                  class="menu-item"
                  type="button"
                  @click.stop="handleEditFeed"
                >
                  {{ t("编辑观点") }}
                </button>
                <button
                  v-if="feed.statusPhase !== 'ended'"
                  class="menu-item"
                  type="button"
                  @click.stop="handleEndFeed"
                >
                  {{ t("手动结束") }}
                </button>
                <button class="menu-item danger" type="button" @click.stop="handleDeleteFeed">
                  {{ t("删除观点") }}
                </button>
              </template>
              <button v-else class="menu-item" type="button" @click.stop="handleHideFeed">
                {{ t("不看这条") }}
              </button>
            </div>
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
        <div class="summary">{{ feed.content }}</div>
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
      <section v-else class="thread-card empty">{{ t("暂无该观点。") }}</section>

      <section v-if="feed" class="reply-panel">
        <div class="reply-header">
          <div class="reply-title">{{ t("留言") }}</div>
          <div class="reply-count">{{ replies.length }}</div>
        </div>
        <div v-if="currentUserId" class="reply-form">
          <textarea
            v-model="replyContent"
            class="reply-input"
            :placeholder="t('写下你的留言')"
            :maxlength="MAX_REPLY_LENGTH"
          ></textarea>
          <div class="reply-actions">
            <span class="reply-hint">{{ t("最多 {count} 字", { count: MAX_REPLY_LENGTH }) }}</span>
            <button
              class="reply-submit"
              type="button"
              :disabled="replySubmitting || !canSubmitReply"
              @click="submitReply"
            >
              {{ replySubmitting ? t("发送中...") : t("发布留言") }}
            </button>
          </div>
        </div>
        <div v-else class="reply-login">
          <span>{{ t("登录后即可留言") }}</span>
          <button class="reply-submit" type="button" @click="goLogin">
            {{ t("去登录") }}
          </button>
        </div>
        <ul v-if="replies.length" class="reply-list">
          <li v-for="reply in replies" :key="reply.reply_id" class="reply-item">
            <span class="reply-avatar" :class="{ empty: !reply.authorAvatar }">
              <img v-if="reply.authorAvatar" :src="reply.authorAvatar" alt="" />
              <span v-else>{{ reply.authorInitial }}</span>
            </span>
            <div class="reply-body">
              <div class="reply-meta">
                <div class="reply-meta-info">
                  <span class="reply-author">{{ reply.author }}</span>
                  <span class="reply-time">{{ reply.createdLabel }}</span>
                </div>
                <div class="reply-more">
                  <button
                    class="reply-more-btn"
                    type="button"
                    @click.stop="toggleReplyMenu(reply.reply_id)"
                  >
                    ...
                  </button>
                  <div v-if="activeReplyMenuId === reply.reply_id" class="reply-menu">
                    <button
                      v-if="reply.isAuthor"
                      class="menu-item danger"
                      type="button"
                      @click.stop="handleDeleteReply(reply)"
                    >
                      {{ t("删除留言") }}
                    </button>
                    <button
                      v-else
                      class="menu-item"
                      type="button"
                      @click.stop="handleHideReply(reply)"
                    >
                      {{ t("不要看到") }}
                    </button>
                  </div>
                </div>
              </div>
              <div class="reply-content">{{ reply.content }}</div>
            </div>
          </li>
        </ul>
        <div v-else class="reply-empty">{{ t("暂无留言") }}</div>
      </section>

      <div class="share-toast" :class="{ show: showShareToast }" role="status" aria-live="polite">
        {{ t("已复制观点链接") }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { t } from "../services/i18n.js";
import { applyShareMeta } from "../services/shareMeta.js";
import { supabase } from "../services/supabase.js";
import {
  addFeedLikeSupabase,
  addFeedReplySupabase,
  fetchFeedByIdSupabase,
  fetchFeedLikesSupabase,
  fetchFeedRepliesSupabase,
  formatFeedTimestamp,
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
const menuOpen = ref(false);
const showShareToast = ref(false);
const replies = ref([]);
const replyContent = ref("");
const replySubmitting = ref(false);
const activeReplyMenuId = ref(null);
const hiddenReplyIds = ref(new Set());
let shareToastTimer = null;
const MAX_REPLY_LENGTH = 200;

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

const canEditFeed = (view) => {
  if (!currentUserId.value || view.user_id !== currentUserId.value) {
    return false;
  }
  const createdAt = new Date(view.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 10 * 60 * 1000;
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

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const closeMenu = () => {
  menuOpen.value = false;
};

const handleEditFeed = async () => {
  if (!feed.value) return;
  const nextContent = window.prompt(t("编辑观点内容"), feed.value.content || "");
  if (!nextContent) return;
  await supabase
    .from("feeds")
    .update({ content: nextContent.trim() })
    .eq("feed_id", feed.value.feed_id);
  await loadFeed();
  closeMenu();
};

const handleEndFeed = async () => {
  if (!feed.value) return;
  const confirmed = window.confirm(t("确定结束这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ status: "expired", expires_at: new Date().toISOString() })
    .eq("feed_id", feed.value.feed_id);
  await loadFeed();
  closeMenu();
};

const handleDeleteFeed = async () => {
  if (!feed.value) return;
  const confirmed = window.confirm(t("确定删除这条观点吗？"));
  if (!confirmed) return;
  await supabase
    .from("feeds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("feed_id", feed.value.feed_id);
  closeMenu();
  handleBack();
};

const handleHideFeed = () => {
  if (!feed.value) return;
  try {
    const raw = localStorage.getItem("twsvp_feed_hidden");
    const ids = raw ? JSON.parse(raw) : [];
    const nextIds = new Set(ids);
    nextIds.add(feed.value.feed_id);
    localStorage.setItem("twsvp_feed_hidden", JSON.stringify([...nextIds]));
  } catch (error) {
    return;
  } finally {
    closeMenu();
    handleBack();
  }
};

const showShareToastMessage = () => {
  showShareToast.value = true;
  if (shareToastTimer) window.clearTimeout(shareToastTimer);
  shareToastTimer = window.setTimeout(() => {
    showShareToast.value = false;
  }, 1800);
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
};

const handleShare = async () => {
  const url = window.location.href;
  const ok = await copyText(url);
  if (ok) {
    showShareToastMessage();
  }
};

const loadUser = async () => {
  const supabaseUser = await getCurrentUserSupabase();
  currentUserId.value = supabaseUser?.id || "";
  await loadLikedIds();
  if (feed.value?.feed_id) {
    await loadReplies(feed.value.feed_id);
  }
};

const loadHiddenReplyIds = () => {
  try {
    const raw = localStorage.getItem("twsvp_reply_hidden");
    const ids = raw ? JSON.parse(raw) : [];
    hiddenReplyIds.value = new Set(ids);
  } catch (error) {
    hiddenReplyIds.value = new Set();
  }
};

const saveHiddenReplyIds = () => {
  localStorage.setItem("twsvp_reply_hidden", JSON.stringify([...hiddenReplyIds.value]));
};

const toggleReplyMenu = (replyId) => {
  activeReplyMenuId.value = activeReplyMenuId.value === replyId ? null : replyId;
};

const closeReplyMenu = () => {
  activeReplyMenuId.value = null;
};

const handleHideReply = (reply) => {
  if (!reply?.reply_id) return;
  hiddenReplyIds.value.add(reply.reply_id);
  saveHiddenReplyIds();
  replies.value = replies.value.filter((item) => item.reply_id !== reply.reply_id);
  closeReplyMenu();
};

const handleDeleteReply = async (reply) => {
  if (!reply?.reply_id) return;
  await supabase.from("feed_replies").delete().eq("reply_id", reply.reply_id);
  replies.value = replies.value.filter((item) => item.reply_id !== reply.reply_id);
  closeReplyMenu();
};

const loadReplies = async (feedId = feed.value?.feed_id) => {
  if (!feedId) {
    replies.value = [];
    return;
  }
  const data = await fetchFeedRepliesSupabase(feedId);
  replies.value = data
    .map((reply) => ({
      ...reply,
      author: reply.users?.nickname || t("用户"),
      authorAvatar: reply.users?.avatar_url || "",
      authorInitial: getInitials(reply.users?.nickname || t("用户")),
      createdLabel: formatFeedTimestamp(reply.created_at),
      isAuthor: currentUserId.value && reply.user_id === currentUserId.value,
    }))
    .filter((reply) => !hiddenReplyIds.value.has(reply.reply_id));
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
    statusPhase: phase,
    directionLabel: mapDirectionToLabel(data.direction),
    createdLabel: formatFeedTimestamp(data.created_at),
    createdDateLabel: formatFeedTimestamp(data.created_at),
    author: data.users?.nickname || t("用户"),
    authorAvatar: data.users?.avatar_url || "",
    authorInitial: getInitials(data.users?.nickname || t("用户")),
    isAuthor: currentUserId.value && data.user_id === currentUserId.value,
    canEdit: canEditFeed(data),
    isLiked: false,
  };
  const shareName = feed.value.target_name || feed.value.target_symbol || t("观点");
  applyShareMeta({ name: shareName, url: window.location.href });
  await loadLikedIds(data.feed_id);
  await loadReplies(data.feed_id);
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

const handleBack = () => {
  if (route.query.from === "search") {
    const q = typeof route.query.q === "string" ? route.query.q : "";
    const tab = typeof route.query.tab === "string" ? route.query.tab : "all";
    router.push({ path: "/search", query: q ? { q, tab } : { tab } });
    return;
  }
  router.push("/feed");
};

const submitReply = async () => {
  if (!feed.value || !currentUserId.value || replySubmitting.value) return;
  const trimmed = replyContent.value.trim();
  if (!trimmed) return;
  replySubmitting.value = true;
  const data = await addFeedReplySupabase({
    feedId: feed.value.feed_id,
    userId: currentUserId.value,
    content: trimmed,
    feedOwnerId: feed.value.user_id,
  });
  replySubmitting.value = false;
  if (!data) return;
  replies.value = [
    ...replies.value,
    {
      ...data,
      author: data.users?.nickname || t("用户"),
      authorAvatar: data.users?.avatar_url || "",
      authorInitial: getInitials(data.users?.nickname || t("用户")),
      createdLabel: formatFeedTimestamp(data.created_at),
      isAuthor: currentUserId.value && data.user_id === currentUserId.value,
    },
  ];
  replyContent.value = "";
};

const goLogin = () => {
  router.push("/login");
};

const canSubmitReply = computed(() => replyContent.value.trim().length > 0);

onMounted(loadHiddenReplyIds);
onMounted(loadUser);
onMounted(loadFeed);
onBeforeUnmount(() => {
  if (shareToastTimer) window.clearTimeout(shareToastTimer);
});
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
  padding: 76px 16px 40px;
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
  display: flex;
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
  background: var(--panel);
  color: var(--ink);
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.author-name {
  font-size: 12px;
  color: var(--ink);
}

.status {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.summary {
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-wrap;
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

.share-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--ink);
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 7;
}

.share-toast.show {
  opacity: 1;
}

.reply-panel {
  margin-top: 16px;
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 12px;
}

.reply-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}

.reply-count {
  font-size: 12px;
  color: var(--muted);
}

.reply-form {
  display: grid;
  gap: 8px;
}

.reply-input {
  min-height: 72px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
}

.reply-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.reply-hint {
  font-size: 12px;
  color: var(--muted);
}

.reply-submit {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}

.reply-submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.reply-login {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.reply-list {
  list-style: none;
  display: grid;
  gap: 10px;
  padding: 0;
  margin: 0;
}

.reply-item {
  display: flex;
  gap: 10px;
}

.reply-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: var(--panel);
  color: var(--ink);
  overflow: hidden;
  flex-shrink: 0;
}

.reply-body {
  flex: 1;
  display: grid;
  gap: 4px;
}

.reply-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.reply-meta-info {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.reply-more {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.reply-more-btn {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 16px;
  color: var(--muted);
  cursor: pointer;
}

.reply-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 120px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  display: grid;
  gap: 6px;
  z-index: 2;
}

.reply-author {
  color: var(--ink);
  font-weight: 500;
}

.reply-content {
  font-size: 13px;
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-wrap;
}

.reply-empty {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
</style>
