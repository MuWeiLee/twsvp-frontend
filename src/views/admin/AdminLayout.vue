<template>
  <div class="app-shell admin-shell">
    <div class="phone-frame admin-frame">
      <header class="admin-nav">
        <div class="admin-brand">
          <img :src="logoUrl" alt="TWSVP" />
        </div>
        <div class="admin-title">后台管理</div>
        <div class="admin-meta">{{ sectionLabel }}</div>
      </header>

      <nav v-if="sectionTabs.length" class="admin-tabs">
        <router-link
          v-for="tab in sectionTabs"
          :key="tab.to"
          class="admin-tab"
          :class="{ active: route.path === tab.to }"
          :to="tab.to"
        >
          {{ tab.label }}
        </router-link>
      </nav>

      <main class="admin-content">
        <router-view />
      </main>

      <nav class="admin-bottom">
        <router-link
          v-for="item in bottomTabs"
          :key="item.key"
          class="bottom-tab"
          :class="{ active: activeSection === item.key }"
          :to="item.to"
        >
          {{ item.label }}
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import logoUrl from "../../assets/logo.png";

const route = useRoute();

const bottomTabs = [
  { key: "data", label: "数据", to: "/admin/backend/dashboard" },
  { key: "content", label: "内容", to: "/admin/backend/content/views" },
  { key: "platform", label: "平台", to: "/admin/backend/platform/articles" },
  { key: "stocks", label: "个股", to: "/admin/backend/stocks" },
  { key: "system", label: "系统", to: "/admin/backend/system/permissions" },
];

const tabsBySection = {
  data: [{ label: "Dashboard", to: "/admin/backend/dashboard" }],
  content: [
    { label: "观点", to: "/admin/backend/content/views" },
    { label: "留言", to: "/admin/backend/content/comments" },
  ],
  platform: [
    { label: "资讯", to: "/admin/backend/platform/articles" },
    { label: "策略包", to: "/admin/backend/platform/strategy-packs" },
  ],
  stocks: [{ label: "个股列表", to: "/admin/backend/stocks" }],
  system: [
    { label: "权限", to: "/admin/backend/system/permissions" },
    { label: "审计日志", to: "/admin/backend/system/audit-logs" },
  ],
};

const activeSection = computed(() => route.meta.section || "data");
const sectionTabs = computed(() => tabsBySection[activeSection.value] || []);

const sectionLabel = computed(() => {
  const item = bottomTabs.find((tab) => tab.key === activeSection.value);
  return item?.label || "数据";
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--bg);
  color: var(--ink);
}

.phone-frame {
  width: min(480px, 100%);
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.admin-nav {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 2;
}

.admin-brand {
  width: 28px;
  height: 28px;
}

.admin-brand img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-title {
  font-size: 18px;
  font-weight: 600;
}

.admin-meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.admin-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg);
  position: sticky;
  top: calc(64px + env(safe-area-inset-top, 0px));
  z-index: 1;
}

.admin-tab {
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  border: 1px solid transparent;
  font-size: 13px;
  text-decoration: none;
  color: var(--ink);
}

.admin-tab.active {
  background: var(--surface);
  border-color: var(--border);
  font-weight: 600;
}

.admin-content {
  flex: 1;
  padding: 8px 16px calc(88px + env(safe-area-inset-bottom, 0px));
}

.admin-bottom {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.bottom-tab {
  text-align: center;
  font-size: 12px;
  text-decoration: none;
  color: var(--muted);
  padding: 6px 4px;
  border-radius: 10px;
}

.bottom-tab.active {
  background: var(--accent-soft);
  color: var(--ink);
  font-weight: 600;
}
</style>
