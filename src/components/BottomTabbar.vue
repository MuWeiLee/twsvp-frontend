<template>
  <nav class="tabbar">
    <router-link class="tab-item" active-class="active" to="/feed">
      <span class="tab-icon" aria-hidden="true">✨</span>
      <span class="tab-label">观点</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/search">
      <span class="tab-icon" aria-hidden="true">🔍</span>
      <span class="tab-label">搜索</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/create-feed">
      <span class="tab-icon" aria-hidden="true">➕</span>
      <span class="tab-label">发布</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/notifications">
      <span class="tab-icon" aria-hidden="true">🔔</span>
      <span class="tab-label">通知</span>
    </router-link>
    <router-link class="tab-item" active-class="active" to="/profile">
      <span class="tab-avatar" :class="{ empty: !avatarUrl }">
        <img v-if="avatarUrl" :src="avatarUrl" alt="我的" />
        <span v-else>{{ avatarFallback }}</span>
      </span>
      <span class="tab-label">我的</span>
    </router-link>
  </nav>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";

const avatarUrl = ref("");
const avatarFallback = ref("我");

const loadAvatar = async () => {
  const user = await getCurrentUserSupabase();
  if (!user) return;
  const profile = await getProfileSupabase(user.id);
  const nickname =
    profile?.nickname ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split("@")[0] : "");
  avatarFallback.value = nickname ? nickname.trim().slice(0, 1) : "我";
  avatarUrl.value = profile?.avatar_url || user.user_metadata?.avatar_url || "";
};

onMounted(loadAvatar);
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(375px, 100%);
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
  font-size: 16px;
  line-height: 1;
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
