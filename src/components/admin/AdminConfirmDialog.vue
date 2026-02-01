<template>
  <div v-if="open" class="confirm-backdrop" @click.self="handleClose">
    <div class="confirm-panel" role="dialog" aria-modal="true">
      <div class="confirm-title">{{ title }}</div>
      <div class="confirm-message">{{ message }}</div>
      <div class="confirm-actions">
        <button class="confirm-btn ghost" type="button" @click="handleClose">
          取消
        </button>
        <button class="confirm-btn danger" type="button" @click="handleConfirm">
          确认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  open: Boolean,
  title: {
    type: String,
    default: "二次确认",
  },
  message: {
    type: String,
    default: "该操作不可撤销，确定继续吗？",
  },
});

const emit = defineEmits(["close", "confirm"]);

const handleClose = () => emit("close");
const handleConfirm = () => emit("confirm");
</script>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 20, 25, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
  padding: 24px;
}

.confirm-panel {
  width: min(360px, 100%);
  background: var(--surface);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.confirm-title {
  font-size: 16px;
  font-weight: 600;
}

.confirm-message {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.confirm-btn {
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
}

.confirm-btn.ghost {
  background: var(--surface);
}

.confirm-btn.danger {
  background: var(--negative);
  color: #fff;
  border-color: var(--negative);
}
</style>
