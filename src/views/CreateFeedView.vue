<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/feed">关闭</router-link>
        <div class="nav-title">发布观点</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <section class="card">
        <div class="section">
          <div class="section-title">标的</div>
          <div class="pill-group">
            <button
              v-for="asset in assets"
              :key="asset"
              class="pill"
              :class="{ active: selectedAsset === asset }"
              @click="selectedAsset = asset"
              type="button"
            >
              {{ asset }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">看法</div>
          <div class="pill-group">
            <button
              v-for="direction in directions"
              :key="direction"
              class="pill"
              :class="{ active: selectedDirection === direction }"
              @click="selectedDirection = direction"
              type="button"
            >
              {{ direction }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">时效</div>
          <div class="pill-group">
            <button
              v-for="horizon in horizons"
              :key="horizon"
              class="pill"
              :class="{ active: selectedHorizon === horizon }"
              @click="selectedHorizon = horizon"
              type="button"
            >
              {{ horizon }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">观点内容</div>
          <textarea
            v-model="content"
            class="content-input"
            placeholder="用一句话说明你的核心判断
你的判断依据
关于观点的风险提示..."
          ></textarea>
          <div class="helper">至少 20 字，最多 1000 字</div>
        </div>

        <button class="btn-primary" :disabled="!isValid || isSubmitting" @click="handlePublish">
          发布
        </button>
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
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import {
  createFeedSupabase,
  mapLabelToDirection,
  mapLabelToHorizon,
} from "../services/feeds.js";

const router = useRouter();
const assets = ["2330 台积电", "2454 联发科", "2603 长荣", "0050 台股 ETF"];
const directions = ["看多", "看空", "中性"];
const horizons = ["短期 5-20 天", "中期 20-60 天", "长期 60-180 天"];

const selectedAsset = ref(assets[0]);
const selectedDirection = ref(directions[0]);
const selectedHorizon = ref(horizons[0]);
const content = ref("");
const isSubmitting = ref(false);

const isValid = computed(() => {
  const length = content.value.trim().length;
  return length >= 20 && length <= 1000;
});

const parseAsset = (value) => {
  const parts = value.trim().split(/\s+/);
  const symbol = parts.shift() || "";
  const name = parts.join(" ") || value.trim();
  return { symbol, name };
};

const handlePublish = async () => {
  if (!isValid.value || isSubmitting.value) {
    return;
  }

  const user = await getCurrentUserSupabase();
  if (!user) {
    router.replace("/login");
    return;
  }

  const { symbol, name } = parseAsset(selectedAsset.value);
  const direction = mapLabelToDirection(selectedDirection.value);
  const horizon = mapLabelToHorizon(selectedHorizon.value);

  try {
    isSubmitting.value = true;
    await createFeedSupabase({
      userId: user.id,
      targetSymbol: symbol,
      targetName: name,
      direction,
      horizon,
      content: content.value.trim(),
    });
    router.replace("/feed");
  } catch (error) {
    alert("发布失败，请稍后重试。");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.app-shell {
  max-width: 480px;
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
  padding: 72px 20px 96px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
}

.nav-title {
  font-weight: 700;
  font-size: 15px;
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

.nav-space {
  width: 28px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 18px;
  border: 1px solid var(--border);
  display: grid;
  gap: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ink);
}

.pill.active {
  border-color: var(--ink);
  background: var(--surface);
}

.content-input {
  width: 100%;
  min-height: 140px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  background: var(--panel);
  resize: vertical;
}

.helper {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.btn-primary {
  border: 0;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
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
</style>
