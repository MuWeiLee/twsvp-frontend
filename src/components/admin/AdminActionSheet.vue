<template>
  <div v-if="open" class="sheet-backdrop" @click.self="handleClose">
    <div class="sheet-panel" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="sheet-title" v-if="title">{{ title }}</div>
      <div class="sheet-actions">
        <button
          v-for="action in safeActions"
          :key="action.label"
          class="sheet-btn"
          type="button"
          @click="() => handleAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
      <div v-if="dangerActions.length" class="sheet-danger">
        <div class="sheet-danger-label">危险操作</div>
        <button
          v-for="action in dangerActions"
          :key="action.label"
          class="sheet-btn danger"
          type="button"
          @click="() => handleAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
      <button class="sheet-cancel" type="button" @click="handleClose">取消</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  open: Boolean,
  title: String,
  safeActions: {
    type: Array,
    default: () => [],
  },
  dangerActions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "action"]);

const handleClose = () => emit("close");

const handleAction = (action) => {
  emit("action", action);
};
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 20, 25, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 40;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}

.sheet-panel {
  width: min(440px, 100%);
  background: var(--surface);
  border-radius: 20px;
  box-shadow: var(--shadow);
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sheet-handle {
  width: 44px;
  height: 4px;
  border-radius: 99px;
  background: var(--border);
  align-self: center;
}

.sheet-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  text-align: center;
}

.sheet-actions,
.sheet-danger {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-danger-label {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}

.sheet-btn {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--surface);
  font-size: 14px;
  text-align: center;
  cursor: pointer;
}

.sheet-btn.danger {
  border-color: rgba(180, 35, 24, 0.4);
  color: var(--negative);
}

.sheet-cancel {
  margin-top: 4px;
  border: 0;
  background: var(--panel);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
}
</style>
