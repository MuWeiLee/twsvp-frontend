<template>
  <nav class="tabbar">
    <router-link class="tab-item" active-class="active" to="/feed">
      <span class="tab-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3l1.7 3.7L17.5 8l-3.8 1.6L12 13.3l-1.7-3.7L6.5 8l3.8-1.3L12 3z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M5 14l.7 1.6L7.5 16l-1.8.7L5 18.4l-.7-1.7L2.5 16l1.8-.4L5 14z"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
          <path
            d="M19 14.5l.8 1.8 1.9.6-1.9.7-.8 1.8-.8-1.8-1.9-.7 1.9-.6.8-1.8z"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="tab-label">{{ t("观点") }}</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/search">
      <span class="tab-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.6" />
          <path d="M16.5 16.5L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </span>
      <span class="tab-label">{{ t("搜索") }}</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/create-feed">
      <span class="tab-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </span>
      <span class="tab-label">{{ t("发布") }}</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/notifications">
      <span class="tab-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4c-3 0-5 2.2-5 5.2v3.2l-1.6 2.4c-.4.6 0 1.2.7 1.2h11.8c.7 0 1.1-.6.7-1.2L17 12.4V9.2C17 6.2 15 4 12 4z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </span>
      <span class="tab-label">{{ t("通知") }}</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/profile">
      <span class="tab-avatar" :class="{ empty: !avatarUrl }">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="t('我的')" />
        <span v-else>{{ avatarFallback }}</span>
      </span>
      <span class="tab-label">{{ t("我的") }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";
import { t } from "../services/i18n.js";

const avatarUrl = ref("");
const avatarFallback = ref(t("我"));

const loadAvatar = async () => {
  const user = await getCurrentUserSupabase();
  if (!user) return;
  const profile = await getProfileSupabase(user.id);
  const nickname =
    profile?.nickname ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split("@")[0] : "");
  avatarFallback.value = nickname ? nickname.trim().slice(0, 1) : t("我");
  avatarUrl.value = profile?.avatar_url || user.user_metadata?.avatar_url || "";
};

onMounted(loadAvatar);
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, 100%);
  bottom: 0;
  min-height: 64px;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 5;
}

.tab-item {
  text-align: center;
  font-size: 11px;
  color: var(--muted);
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  justify-content: center;
}

.tab-item.active {
  color: var(--ink);
  font-weight: 600;
}

.tab-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  color: currentColor;
}

.tab-icon svg {
  width: 20px;
  height: 20px;
}

.tab-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  background: var(--panel);
  color: var(--ink);
  overflow: hidden;
}

.tab-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tab-avatar.empty {
  background: var(--panel);
}

.tab-label {
  font-size: 11px;
}
</style>
