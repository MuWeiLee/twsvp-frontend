<template>
  <div v-if="open" class="edit-overlay" @click.self="emit('close')">
    <div class="edit-sheet">
      <header class="edit-header">
        <div class="edit-title">{{ t("编辑观点") }}</div>
        <button class="icon-btn" type="button" @click="emit('close')" :aria-label="t('关闭')">
          ✕
        </button>
      </header>

      <section class="card">
        <div class="section">
          <div class="section-title">
            <span>{{ t("观点内容") }}</span>
            <span v-if="overLimitCount" class="limit-alert">{{ overLimitCount }}</span>
          </div>
          <textarea
            v-model="draftContent"
            class="content-input"
            :placeholder="t('用一句话说明你的核心判断\n你的判断依据\n关于观点的风险提示...')"
          ></textarea>
          <div class="helper">{{ t("每个观点最少 20 字") }}</div>
        </div>

        <div class="section is-disabled">
          <div class="section-title">{{ t("标的") }}</div>
          <input class="text-input" type="text" :value="targetLabel" disabled />
        </div>

        <div class="section is-disabled">
          <div class="section-title">{{ t("看法") }}</div>
          <div class="pill-group">
            <button
              v-for="direction in directions"
              :key="direction"
              class="pill"
              :class="{ active: direction === directionLabel }"
              type="button"
              disabled
            >
              {{ direction }}
            </button>
          </div>
        </div>

        <div class="section is-disabled">
          <div class="section-title">{{ t("时效") }}</div>
          <div class="pill-group">
            <button
              v-for="horizon in horizons"
              :key="horizon"
              class="pill"
              :class="{ active: horizon === horizonLabel }"
              type="button"
              disabled
            >
              {{ horizon }}
            </button>
          </div>
        </div>
      </section>

      <div class="edit-actions">
        <button class="btn-secondary" type="button" @click="emit('close')">
          {{ t("取消") }}
        </button>
        <button
          class="btn-primary"
          type="button"
          :disabled="!isValid || saving"
          @click="handleSave"
        >
          {{ t("保存修改") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { t } from "../services/i18n.js";
import { mapDirectionToLabel, mapHorizonToLabel } from "../services/feeds.js";

const props = defineProps({
  open: Boolean,
  feed: {
    type: Object,
    default: null,
  },
  saving: Boolean,
});

const emit = defineEmits(["close", "save"]);

const draftContent = ref("");

watch(
  () => props.feed,
  (next) => {
    draftContent.value = next?.content || "";
  },
  { immediate: true }
);

const directions = computed(() => [
  t("看多"),
  t("中性"),
  t("看空"),
]);

const horizons = computed(() => [
  t("极短期 5天内"),
  t("短期 5-20天"),
  t("中期 20-60天"),
  t("长期 60-180天"),
]);

const directionLabel = computed(() =>
  props.feed ? mapDirectionToLabel(props.feed.direction) : ""
);
const horizonLabel = computed(() =>
  props.feed ? mapHorizonToLabel(props.feed.horizon) : ""
);

const targetLabel = computed(() => {
  if (!props.feed) return "";
  return [props.feed.target_symbol, props.feed.target_name].filter(Boolean).join(" ");
});

const isValid = computed(() => {
  const length = draftContent.value.trim().length;
  return length >= 20 && length <= 1000;
});

const overLimitCount = computed(() => {
  const length = draftContent.value.trim().length;
  return length > 1000 ? length - 1000 : 0;
});

const handleSave = () => {
  emit("save", draftContent.value);
};
</script>

<style scoped>
.edit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 18, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 30;
  padding: 16px;
}

.edit-sheet {
  width: 100%;
  max-width: 600px;
  background: var(--bg);
  border-radius: 18px;
  border: 1px solid var(--border);
  box-shadow: 0 18px 30px rgba(15, 20, 25, 0.18);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.edit-title {
  font-size: 18px;
  font-weight: 600;
}

.icon-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  border-radius: 10px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.limit-alert {
  color: var(--price-down);
  font-weight: 600;
}

.content-input {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--ink);
  font-size: 14px;
  resize: vertical;
}

.text-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--ink);
  font-size: 14px;
}

.helper {
  font-size: 12px;
  color: var(--muted);
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  border-radius: 999px;
  border: 1px solid var(--border);
  padding: 6px 14px;
  background: var(--panel);
  color: var(--ink);
  font-size: 12px;
  cursor: pointer;
}

.pill.active {
  border-color: var(--ink);
  background: var(--surface);
}

.section.is-disabled {
  opacity: 0.6;
}

.section.is-disabled .pill,
.section.is-disabled .text-input {
  cursor: not-allowed;
}

.edit-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-secondary,
.btn-primary {
  border-radius: 999px;
  padding: 10px 18px;
  font-size: 14px;
  cursor: pointer;
}

.btn-secondary {
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--ink);
}

.btn-primary {
  background: var(--ink);
  color: #fff;
  border: none;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
