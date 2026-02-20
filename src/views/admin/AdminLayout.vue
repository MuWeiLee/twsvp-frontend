<template>
  <div class="app-shell admin-shell">
    <div class="admin-frame">
      <header class="admin-topbar">
        <div class="topbar-left">
          <div class="admin-brand">
            <img :src="logoUrl" alt="TWSVP" />
          </div>
          <div class="admin-title-wrap">
            <div class="admin-title">后台管理</div>
            <div class="admin-subtitle">{{ activeSectionLabel }}</div>
          </div>
        </div>
        <router-link class="admin-exit" to="/feed">退出后台</router-link>
      </header>

      <div class="admin-body">
        <aside class="admin-sidebar">
          <div class="menu-group">
            <div class="menu-title">主导航</div>
            <router-link
              v-for="item in bottomTabs"
              :key="item.key"
              class="side-link"
              :class="{ active: activeSection === item.key }"
              :to="item.to"
            >
              {{ item.label }}
            </router-link>
          </div>

          <div v-if="sectionTabs.length" class="menu-group">
            <div class="menu-title">当前分区</div>
            <router-link
              v-for="tab in sectionTabs"
              :key="tab.to"
              class="side-link section-link"
              :class="{ active: route.path === tab.to }"
              :to="tab.to"
            >
              {{ tab.label }}
            </router-link>
          </div>
        </aside>

        <main class="admin-main">
          <nav v-if="sectionTabs.length" class="admin-tabs-mobile">
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

          <section class="admin-content">
            <router-view />
          </section>
        </main>
      </div>

      <nav class="admin-bottom-mobile">
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

const sectionLabels = {
  data: "数据与指标",
  content: "内容管理",
  platform: "平台配置",
  stocks: "个股资料",
  system: "系统设置",
};

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
const activeSectionLabel = computed(
  () => sectionLabels[activeSection.value] || "后台工作台"
);

</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  justify-content: stretch;
  background: var(--bg);
  color: var(--ink);
}

.admin-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.admin-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 20px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 30;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
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

.admin-title-wrap {
  display: grid;
  gap: 2px;
}

.admin-title {
  font-size: 16px;
  font-weight: 600;
}

.admin-subtitle {
  font-size: 12px;
  color: var(--muted);
}

.admin-exit {
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.admin-exit:hover {
  color: var(--ink);
  border-color: var(--accent);
}

.admin-body {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 0;
  min-height: calc(100vh - 58px - env(safe-area-inset-top, 0px));
  margin-top: calc(58px + env(safe-area-inset-top, 0px));
}

.admin-sidebar {
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 16px 12px;
  position: sticky;
  top: calc(58px + env(safe-area-inset-top, 0px));
  height: calc(100vh - 58px - env(safe-area-inset-top, 0px));
  overflow: auto;
}

.menu-group + .menu-group {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.menu-title {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 8px;
}

.side-link {
  display: block;
  text-decoration: none;
  color: var(--ink);
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
}

.side-link + .side-link {
  margin-top: 6px;
}

.side-link.active {
  background: var(--accent-soft);
  border-color: var(--border);
  font-weight: 600;
}

.section-link {
  font-size: 12px;
}

.admin-main {
  min-width: 0;
  padding: 14px 20px;
}

.admin-tabs-mobile {
  display: none;
  gap: 8px;
  padding: 4px 0 12px;
  background: var(--bg);
  overflow-x: auto;
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
  padding-bottom: 18px;
}

.admin-bottom-mobile {
  display: none;
}

@media (max-width: 900px) {
  .admin-body {
    grid-template-columns: 1fr;
    margin-top: calc(58px + env(safe-area-inset-top, 0px));
    min-height: auto;
  }

  .admin-sidebar {
    display: none;
  }

  .admin-main {
    padding: 12px 14px;
  }

  .admin-tabs-mobile {
    display: flex;
    position: sticky;
    top: calc(58px + env(safe-area-inset-top, 0px));
    z-index: 20;
  }

  .admin-content {
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  }

  .admin-bottom-mobile {
    position: fixed;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--surface);
    border-top: 1px solid var(--border);
    z-index: 40;
  }
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
