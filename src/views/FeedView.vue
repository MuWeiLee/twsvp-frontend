<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">T</router-link>
        <div class="nav-title">广场</div>
        <router-link class="nav-btn" to="/search">搜索</router-link>
      </nav>

      <header class="slide-in">
        <div style="display: flex; justify-content: flex-end">
          <a class="nav-btn" href="#publish">发布观点</a>
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: mode === 'latest' }"
            @click="mode = 'latest'"
          >
            最新
          </button>
          <button
            class="tab-btn"
            :class="{ active: mode === 'trending' }"
            @click="mode = 'trending'"
          >
            推荐
          </button>
        </div>

        <div id="publish" class="composer">
          <div class="composer-top">
            <div class="avatar">{{ user.initials }}</div>
            <textarea
              class="composer-input"
              placeholder="写下你的观点（标的、方向、时效）"
              v-model="draft"
            ></textarea>
          </div>
          <div class="composer-meta">
            <div>
              <span class="chip">标的：{{ composer.asset }}</span>
              <span class="chip">方向：{{ composer.direction }}</span>
              <span class="chip">时效：{{ composer.horizon }}</span>
            </div>
            <button class="btn-primary" @click="handlePublish">发布</button>
          </div>
        </div>
      </header>

      <section class="feed">
        <div v-for="view in filteredViews" :key="view.id" class="thread slide-in">
          <div class="thread-dot" aria-hidden="true"></div>
          <div class="thread-card">
            <div class="thread-header">
              <span>{{ view.asset }}</span>
              <span class="tag">{{ view.horizon }}</span>
            </div>
            <div class="thread-meta">
              <span class="direction" :class="directionClass(view.direction)">
                {{ view.direction }}
              </span>
              <span>作者 {{ view.author }}</span>
              <span>{{ view.date }}</span>
            </div>
            <div>{{ view.content }}</div>
            <div class="thread-footer">
              <span>讨论 {{ view.comments }}</span>
              <span>收藏 {{ view.saves }}</span>
            </div>
          </div>
        </div>
      </section>

      <p class="legal">
        广场仅展示观点记录与回溯，不构成任何投资建议。
      </p>

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

const mode = ref("latest");
const draft = ref("");
const user = ref({
  initials: "林",
});
const composer = ref({
  asset: "2330 台积电",
  direction: "看多",
  horizon: "10 个交易日",
});
const views = ref([
  {
    id: 1,
    asset: "2330 台积电",
    direction: "看多",
    horizon: "10 个交易日",
    author: "林可心",
    date: "刚刚",
    comments: 12,
    saves: 8,
    content: "法说会后动能持续，关注外资回补与量能变化。",
    mode: "latest",
  },
  {
    id: 2,
    asset: "2454 联发科",
    direction: "中性",
    horizon: "5 个交易日",
    author: "陈映帆",
    date: "10 分钟前",
    comments: 6,
    saves: 3,
    content: "区间震荡为主，等待新一轮催化确定方向。",
    mode: "latest",
  },
  {
    id: 3,
    asset: "2603 长荣",
    direction: "看空",
    horizon: "20 个交易日",
    author: "张以安",
    date: "1 小时前",
    comments: 21,
    saves: 14,
    content: "运价回落压力增大，短期风险偏高。",
    mode: "latest",
  },
  {
    id: 4,
    asset: "2382 广达",
    direction: "看多",
    horizon: "10 个交易日",
    author: "周知晓",
    date: "3 小时前",
    comments: 28,
    saves: 19,
    content: "订单能见度提升，关注财报后的估值修复。",
    mode: "trending",
  },
  {
    id: 5,
    asset: "2308 台达电",
    direction: "中性",
    horizon: "10 个交易日",
    author: "何雨静",
    date: "今天",
    comments: 9,
    saves: 6,
    content: "短线波动大，等待量价关系进一步明确。",
    mode: "trending",
  },
]);

const filteredViews = computed(() =>
  views.value.filter((view) => view.mode === mode.value)
);

const directionClass = (direction) => {
  if (direction.includes("看多")) return "bullish";
  if (direction.includes("看空")) return "bearish";
  return "neutral";
};

const handlePublish = () => {
  alert("发布示例：打开结构化发文弹窗。");
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
  font-family: "Inter", "Source Han Serif", "Noto Serif SC", sans-serif;
  font-weight: 700;
  font-size: 16px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--section);
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
  background: var(--ink);
  display: grid;
  place-items: center;
  font-family: "Inter", "Source Han Serif", "Noto Serif SC", sans-serif;
  font-weight: 700;
  color: #fff;
  border: 0;
  text-decoration: none;
}

.tabs {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  background: var(--section);
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.tab-btn {
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 0;
  border-radius: 999px;
  cursor: pointer;
  color: var(--muted);
}

.tab-btn.active {
  background: var(--card);
  color: var(--ink);
  box-shadow: var(--shadow);
}

.composer {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: grid;
  gap: 12px;
  background: var(--card);
}

.composer-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: var(--section);
  display: grid;
  place-items: center;
  font-weight: 600;
}

.composer-input {
  flex: 1;
  min-height: 84px;
  border: 0;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.composer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--section);
  color: var(--text-secondary);
  margin-right: 6px;
}

.btn-primary {
  border: 0;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 999px;
  cursor: pointer;
}

.feed {
  margin-top: 18px;
  display: grid;
  gap: 16px;
}

.thread {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
  align-items: start;
}

.thread-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ink);
  margin-top: 6px;
}

.thread-card {
  background: var(--card);
  border-radius: var(--radius);
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
  background: var(--tag-neutral-bg);
  color: var(--tag-neutral-text);
}

.direction {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--tag-neutral-bg);
  color: var(--tag-neutral-text);
}

.direction.bullish {
  background: var(--tag-bullish-bg);
  color: var(--tag-bullish-text);
}

.direction.bearish {
  background: var(--tag-bearish-bg);
  color: var(--tag-bearish-text);
}

.direction.neutral {
  background: var(--tag-neutral-bg);
  color: var(--tag-neutral-text);
}

.thread-footer {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--muted);
}

.legal {
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
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
  background: var(--card);
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
    padding: 68px 16px 88px;
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
