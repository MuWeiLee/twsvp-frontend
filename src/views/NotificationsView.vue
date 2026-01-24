<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">T</router-link>
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

      <nav class="tabbar">
        <router-link class="tab-item" active-class="active" to="/feed">观点流</router-link>
        <router-link class="tab-item" active-class="active" to="/search">搜索</router-link>
        <router-link class="tab-item" active-class="active" to="/create-feed">发布</router-link>
        <router-link class="tab-item" active-class="active" to="/notifications">通知</router-link>
        <router-link class="tab-item" active-class="active" to="/profile">个人中心</router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

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
  max-width: 480px;
  margin: 0 auto;
  background: transparent;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  padding: 72px 20px 96px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 5;
}

.nav-title {
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  font-size: 16px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
}

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--ink);
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  color: #fff;
  border: 1px solid var(--border);
  text-decoration: none;
}

.nav-space {
  width: 46px;
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

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  bottom: 0;
  margin-top: 0;
  min-height: 56px;
  padding: 10px 6px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 5;
}

.tab-item {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  display: block;
  width: 100%;
}

.tab-item.active {
  color: var(--ink);
  font-weight: 600;
}

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}
</style>
