<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">T</router-link>
        <div class="nav-title">搜索</div>
        <router-link class="nav-btn" to="/notifications">通知</router-link>
      </nav>

      <section class="search">
        <div class="search-bar">
          <input
            class="search-input"
            type="text"
            placeholder="搜索股票、话题或作者"
            v-model="query"
            @input="handleInput"
          />
          <button class="btn-primary" @click="handleSearch">搜索</button>
          <button class="btn-ghost" @click="clearSearch">清除</button>
        </div>

        <div class="section-title">热门标的</div>
        <div class="pill-group">
          <span v-for="item in trendingStocks" :key="item" class="pill">{{ item }}</span>
        </div>

        <div class="section-title">热议话题</div>
        <div class="pill-group">
          <span v-for="item in trendingTags" :key="item" class="pill">{{ item }}</span>
        </div>

        <section v-if="!submittedQuery">
          <div class="section-title">为你推荐</div>
          <div class="list">
            <div v-for="item in matchedSuggestions" :key="item.label" class="list-item">
              <strong>{{ item.label }}</strong>
              <span>{{ item.type }}</span>
            </div>
          </div>
          <div class="empty" v-if="!matchedSuggestions.length">没有匹配结果</div>
        </section>

        <section v-else>
          <div class="section-title">搜索结果</div>
          <div v-if="filteredViews.length" class="feed">
            <div v-for="view in filteredViews" :key="view.id" class="thread">
              <div class="thread-dot" aria-hidden="true"></div>
              <div class="thread-card">
                <div class="thread-header">
                  <span>{{ view.asset }}</span>
                  <span class="tag">{{ view.horizon }}</span>
                </div>
                <div class="thread-meta">
                  <span class="direction">{{ view.direction }}</span>
                  <span>作者 {{ view.author }}</span>
                  <span>{{ view.date }}</span>
                </div>
                <div>{{ view.content }}</div>
              </div>
            </div>
          </div>
          <div v-else class="empty">暂无相关观点</div>
        </section>
      </section>

      <nav class="tabbar">
        <router-link class="tab-item" active-class="active" to="/feed">广场</router-link>
        <router-link class="tab-item" active-class="active" to="/search">搜索</router-link>
        <router-link class="tab-item" :to="{ path: '/feed', hash: '#publish' }">
          发布
        </router-link>
        <router-link class="tab-item" active-class="active" to="/notifications">通知</router-link>
        <router-link class="tab-item" active-class="active" to="/profile">我的</router-link>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const query = ref("");
const submittedQuery = ref("");
const trendingStocks = ref(["2330 台积电", "2454 联发科", "2382 广达"]);
const trendingTags = ref(["#AI概念股", "#台积电法说", "#降息预期"]);
const suggestions = ref([
  { label: "2330 台积电", type: "股票" },
  { label: "2454 联发科", type: "股票" },
  { label: "2603 长荣", type: "股票" },
  { label: "#AI概念股", type: "话题" },
  { label: "#台积电法说", type: "话题" },
  { label: "#降息预期", type: "话题" },
]);
const views = ref([
  {
    id: 1,
    asset: "2330 台积电",
    direction: "看多",
    horizon: "10 个交易日",
    author: "林可心",
    date: "刚刚",
    content: "法说会后动能持续，关注外资回补与量能变化。",
    keywords: ["2330", "台积电", "AI"],
  },
  {
    id: 2,
    asset: "2454 联发科",
    direction: "中性",
    horizon: "5 个交易日",
    author: "陈映帆",
    date: "10 分钟前",
    content: "区间震荡为主，等待新一轮催化确定方向。",
    keywords: ["2454", "联发科"],
  },
  {
    id: 3,
    asset: "2603 长荣",
    direction: "看空",
    horizon: "20 个交易日",
    author: "张以安",
    date: "1 小时前",
    content: "运价回落压力增大，短期风险偏高。",
    keywords: ["2603", "长荣"],
  },
]);

const matchedSuggestions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return suggestions.value.filter((item) =>
    item.label.toLowerCase().includes(q)
  );
});

const filteredViews = computed(() => {
  const q = submittedQuery.value.trim().toLowerCase();
  if (!q) return [];
  return views.value.filter((view) => {
    const text = `${view.asset} ${view.content}`.toLowerCase();
    return (
      text.includes(q) ||
      view.keywords.some((keyword) => keyword.toLowerCase().includes(q))
    );
  });
});

const handleInput = () => {
  if (!query.value.trim()) {
    submittedQuery.value = "";
  } else if (submittedQuery.value) {
    submittedQuery.value = "";
  }
};

const handleSearch = () => {
  const q = query.value.trim();
  if (!q) return;
  submittedQuery.value = q;
};

const clearSearch = () => {
  query.value = "";
  submittedQuery.value = "";
};
</script>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  background: var(--card);
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--card);
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
  background: var(--card);
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
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
}

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #111;
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  color: #fff;
  border: 0;
  text-decoration: none;
}

.search {
  display: grid;
  gap: 18px;
}

.search-bar {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
}

.search-input {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-top: 6px;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: #f3f4f6;
  font-size: 12px;
}

.list {
  display: grid;
  gap: 10px;
}

.list-item {
  background: #fff;
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.empty {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: var(--muted);
}

.feed {
  display: grid;
  gap: 12px;
}

.thread {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
}

.thread-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #111;
  margin-top: 6px;
}

.thread-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid var(--border);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.thread-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #f3f4f6;
  color: #111;
}

.direction {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #111;
  color: #fff;
}

.btn-primary {
  border: 0;
  background: #111;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 999px;
  cursor: pointer;
}

.btn-ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
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
  min-height: 48px;
  padding: 12px 6px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: #fff;
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
