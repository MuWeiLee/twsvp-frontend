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
        <div v-for="item in filteredItems" :key="item.id" class="item">
          <strong>{{ item.title }}</strong>
          <span>{{ item.detail }}</span>
          <span class="meta">{{ item.time }}</span>
        </div>
      </section>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import logoUrl from "../assets/logo.png";
import BottomTabbar from "../components/BottomTabbar.vue";

const activeTab = ref("like");
const items = ref([
  {
    id: 1,
    type: "like",
    title: "有人点赞了你的观点",
    detail: "林以安点赞了「2330 台积电」",
    time: "5 分钟前",
  },
  {
    id: 2,
    type: "share",
    title: "观点被分享",
    detail: "张以安分享了「2603 长荣」",
    time: "30 分钟前",
  },
  {
    id: 3,
    type: "expire",
    title: "观点即将到期",
    detail: "你的观点「2454 联发科」将在 2 天后到期",
    time: "今天",
  },
]);

const filteredItems = computed(() => {
  if (activeTab.value === "expire") {
    return items.value.filter((item) => item.type === "expire");
  }
  return items.value.filter((item) => item.type === activeTab.value);
});
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
  display: grid;
  gap: 4px;
  background: var(--surface);
}

.item span {
  font-size: 12px;
  color: var(--muted);
}

.meta {
  margin-top: 4px;
}

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}
</style>
