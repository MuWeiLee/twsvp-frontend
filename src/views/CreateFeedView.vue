<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-link" to="/feed">关闭</router-link>
        <div class="nav-title">我的观点</div>
        <button class="nav-link ghost" type="button" @click="saveDraft">保存草稿</button>
      </nav>

      <section class="card">
        <div class="section">
          <div class="section-title">
            <span>观点内容</span>
            <span v-if="overLimitCount" class="limit-alert">{{ overLimitCount }}</span>
          </div>
          <textarea
            v-model="content"
            class="content-input"
            placeholder="用一句话说明你的核心判断
你的判断依据
关于观点的风险提示..."
          ></textarea>
          <div class="helper">每个观点最少 20 字</div>
        </div>

        <div class="section">
          <div class="section-title">标的</div>
          <input
            v-model="targetInput"
            class="text-input"
            type="text"
            placeholder="请输入标的"
          />
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
      </section>

      <div class="bottom-actions">
        <button
          class="btn-primary btn-fixed"
          :disabled="!isValid || isSubmitting"
          @click="handlePublish"
        >
          发布观点
        </button>
      </div>

      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import BottomTabbar from "../components/BottomTabbar.vue";
import { getCurrentUserSupabase } from "../services/auth.js";
import {
  createFeedSupabase,
  mapLabelToDirection,
  mapLabelToHorizon,
} from "../services/feeds.js";

const router = useRouter();
const directions = ["看多", "中性", "看空"];
const horizons = ["短期 5-20天", "中期 20-60天", "长期 60-180天"];

const selectedDirection = ref(directions[0]);
const selectedHorizon = ref(horizons[0]);
const content = ref("");
const targetInput = ref("");
const isSubmitting = ref(false);
const DRAFT_KEY = "twsvp_feed_draft";

const isValid = computed(() => {
  const length = content.value.trim().length;
  return length >= 20 && length <= 1000 && targetInput.value.trim().length > 0;
});

const overLimitCount = computed(() => {
  const length = content.value.trim().length;
  return length > 1000 ? length - 1000 : 0;
});

const parseTarget = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return { symbol: "", name: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const symbol = parts.shift() || "";
    const name = parts.join(" ");
    return { symbol, name };
  }
  return { symbol: trimmed, name: trimmed };
};

const saveDraft = () => {
  const draft = {
    content: content.value,
    targetInput: targetInput.value,
    selectedDirection: selectedDirection.value,
    selectedHorizon: selectedHorizon.value,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    content.value = draft.content || content.value;
    targetInput.value = draft.targetInput || targetInput.value;
    selectedDirection.value = draft.selectedDirection || selectedDirection.value;
    selectedHorizon.value = draft.selectedHorizon || selectedHorizon.value;
  } catch (error) {
    localStorage.removeItem(DRAFT_KEY);
  }
};
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

  if (!targetInput.value.trim()) {
    return;
  }

  const { symbol, name } = parseTarget(targetInput.value);
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
    localStorage.removeItem(DRAFT_KEY);
    router.replace("/feed");
  } catch (error) {
    alert("发布失败，请稍后重试。");
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(loadDraft);
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
  padding: 76px 16px 170px;
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

.nav-link {
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

.nav-link.ghost {
  border-color: transparent;
  background: transparent;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.limit-alert {
  color: var(--negative);
  font-size: 12px;
  font-weight: 600;
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

.text-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  background: var(--surface);
}

.helper {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.bottom-actions {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 64px;
  width: min(375px, 100%);
  padding: 12px 16px;
  background: linear-gradient(0deg, var(--bg) 70%, rgba(239, 239, 239, 0));
  z-index: 4;
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

.btn-fixed {
  width: 100%;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

</style>
