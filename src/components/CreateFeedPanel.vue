<template>
  <div class="create-feed" :style="panelStyle">
    <nav class="nav">
      <button class="nav-btn" type="button" :aria-label="t('关闭')" @click="handleClose">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6l-12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <div class="nav-title">{{ t("我的观点") }}</div>
      <button class="nav-link ghost" type="button" @click="saveDraft">
        {{ t("保存草稿") }}
      </button>
    </nav>

    <section class="card">
      <div class="section">
        <div class="section-title">
          <span>{{ t("观点内容") }}</span>
          <span v-if="overLimitCount" class="limit-alert">{{ overLimitCount }}</span>
        </div>
        <textarea
          v-model="content"
          class="content-input"
          :placeholder="t('用一句话说明你的核心判断\n你的判断依据\n关于观点的风险提示...')"
        ></textarea>
        <div class="helper" :class="{ error: showContentError }">
          {{ t("每个观点至少20字") }}
        </div>
      </div>

      <div class="section">
        <div class="section-title">{{ t("标的") }}</div>
        <div class="search-field">
          <input
            v-model="targetInput"
            class="text-input"
            type="text"
            :placeholder="t('搜索并选择标的')"
          />
          <div class="helper" :class="{ error: showTargetError }">
            {{ t("请输入公司名称或股票代码进行搜索") }}
          </div>
          <div v-if="isStockLoading && !stockResults.length" class="search-tip">
            {{ t("正在搜索...") }}
          </div>
          <div v-if="stockResults.length" class="search-results">
            <button
              v-for="stock in stockResults"
              :key="stock.stock_id"
              type="button"
              class="search-item"
              @click="selectStock(stock)"
            >
              <span class="search-code">{{ stock.stock_id }}</span>
              <span class="search-name">{{ stock.name }}</span>
              <span class="search-market">{{ stock.market }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">{{ t("看法") }}</div>
        <div class="pill-group">
          <button
            v-for="direction in directions"
            :key="direction"
            class="pill"
            :class="{ active: selectedDirection === direction }"
            @click="selectedDirection = direction"
            type="button"
          >
            {{ t(direction) }}
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">{{ t("时效") }}</div>
        <div class="pill-group">
          <button
            v-for="horizon in horizons"
            :key="horizon"
            class="pill"
            :class="{ active: selectedHorizon === horizon }"
            @click="selectedHorizon = horizon"
            type="button"
          >
            {{ t(horizon) }}
          </button>
        </div>
      </div>
    </section>

    <div class="bottom-actions">
      <button class="btn-primary btn-fixed" :disabled="isSubmitting" @click="handlePublish">
        {{ t("发布观点") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { searchStocksSupabase } from "../services/stocks.js";
import { createFeedSupabase, mapLabelToDirection, mapLabelToHorizon } from "../services/feeds.js";
import { t } from "../services/i18n.js";

const props = defineProps({
  initialStock: {
    type: Object,
    default: null,
  },
  bottomOffset: {
    type: Number,
    default: 64,
  },
});

const emit = defineEmits(["close", "published"]);

const router = useRouter();
const directions = ["看多", "中性", "看空"];
const horizons = ["极短期 5天内", "短期 5-20天", "中期 20-60天", "长期 60-180天"];

const selectedDirection = ref(directions[0]);
const selectedHorizon = ref(horizons[0]);
const content = ref("");
const targetInput = ref("");
const isSubmitting = ref(false);
const stockResults = ref([]);
const isStockLoading = ref(false);
const selectedStock = ref(null);
const showErrors = ref(false);
const DRAFT_KEY = "twsvp_feed_draft";
let stockSearchTimer = null;

const panelStyle = computed(() => ({
  "--bottom-actions-offset": `${props.bottomOffset}px`,
}));

const isValid = computed(() => {
  const length = content.value.trim().length;
  return length >= 20 && length <= 1000 && !!selectedStock.value;
});

const showContentError = computed(() => {
  const length = content.value.trim().length;
  return showErrors.value && length < 20;
});

const showTargetError = computed(() => showErrors.value && !selectedStock.value);

const overLimitCount = computed(() => {
  const length = content.value.trim().length;
  return length > 1000 ? length - 1000 : 0;
});

const getStockLabel = (stock) => `${stock.stock_id} ${stock.name}`;

const saveDraft = () => {
  const draft = {
    content: content.value,
    targetInput: targetInput.value,
    selectedStock: selectedStock.value,
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
    if (draft.selectedStock?.stock_id) {
      selectedStock.value = draft.selectedStock;
      targetInput.value = getStockLabel(draft.selectedStock);
    } else {
      targetInput.value = draft.targetInput || targetInput.value;
    }
    selectedDirection.value = draft.selectedDirection || selectedDirection.value;
    selectedHorizon.value = draft.selectedHorizon || selectedHorizon.value;
  } catch (error) {
    localStorage.removeItem(DRAFT_KEY);
  }
};

const applyInitialStock = (stock) => {
  if (!stock?.stock_id) return;
  selectedStock.value = stock;
  targetInput.value = getStockLabel(stock);
};

const searchStocks = () => {
  const q = targetInput.value.trim();
  clearTimeout(stockSearchTimer);
  if (!q) {
    stockResults.value = [];
    selectedStock.value = null;
    return;
  }

  stockSearchTimer = setTimeout(async () => {
    isStockLoading.value = true;
    const results = await searchStocksSupabase(q, 8);
    stockResults.value = results;
    isStockLoading.value = false;
  }, 250);
};

const selectStock = (stock) => {
  selectedStock.value = stock;
  targetInput.value = getStockLabel(stock);
  stockResults.value = [];
};

const handlePublish = async () => {
  showErrors.value = true;
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

  if (!selectedStock.value) {
    return;
  }

  const direction = mapLabelToDirection(selectedDirection.value);
  const horizon = mapLabelToHorizon(selectedHorizon.value);

  try {
    isSubmitting.value = true;
    await createFeedSupabase({
      userId: user.id,
      targetSymbol: selectedStock.value.stock_id,
      targetName: selectedStock.value.name,
      direction,
      horizon,
      content: content.value.trim(),
    });
    localStorage.removeItem(DRAFT_KEY);
    emit("published");
  } catch (error) {
    alert(t("发布失败，请稍后重试。"));
  } finally {
    isSubmitting.value = false;
  }
};

const handleClose = () => {
  emit("close");
};

watch(
  targetInput,
  (value) => {
    if (selectedStock.value) {
      const label = getStockLabel(selectedStock.value);
      if (value.trim() !== label) {
        selectedStock.value = null;
      }
    }
    searchStocks();
  }
);

watch(
  () => props.initialStock,
  (value) => {
    applyInitialStock(value);
  }
);

onMounted(() => {
  loadDraft();
  applyInitialStock(props.initialStock);
});
</script>

<style scoped>
.create-feed {
  width: 100%;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
}

.nav-title {
  font-weight: 500;
  font-size: 20px;
  margin-right: auto;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  width: 32px;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
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

.search-field {
  position: relative;
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

.search-tip {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  font-size: 12px;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  z-index: 5;
}

.search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  display: grid;
  overflow: hidden;
  z-index: 6;
  box-shadow: var(--shadow);
}

.search-item {
  display: grid;
  grid-template-columns: 64px 1fr 56px;
  gap: 8px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  color: var(--ink);
}

.search-item:last-child {
  border-bottom: 0;
}

.search-code {
  font-weight: 600;
}

.search-name {
  color: var(--ink);
}

.search-market {
  color: var(--muted);
  text-align: right;
}

.helper {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.helper.error {
  color: var(--negative);
}

.bottom-actions {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--bottom-actions-offset) + env(safe-area-inset-bottom, 0px));
  width: min(600px, 100%);
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
