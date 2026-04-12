<template>
  <Transition name="confirm-fade">
    <div v-if="confirmState" class="confirm-overlay" @click.self="cancel">
      <div class="confirm-sheet">
        <p class="confirm-message">{{ confirmState.message }}</p>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" type="button" @click="cancel">
            {{ t("取消") }}
          </button>
          <button class="confirm-btn ok danger" type="button" @click="ok">
            {{ t("确定") }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { confirmState, resolveConfirm } from "../services/confirm.js";
import { t } from "../services/i18n.js";

const ok = () => resolveConfirm(true);
const cancel = () => resolveConfirm(false);
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9998;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.confirm-sheet {
  width: 100%;
  max-width: 600px;
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirm-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  text-align: center;
  padding: 4px 8px;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  border: 1px solid var(--border);
  cursor: pointer;
  background: var(--surface);
  color: var(--ink);
}

.confirm-btn.danger {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}

.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-fade-enter-active .confirm-sheet,
.confirm-fade-leave-active .confirm-sheet {
  transition: transform 0.2s ease;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.confirm-fade-enter-from .confirm-sheet,
.confirm-fade-leave-to .confirm-sheet {
  transform: translateY(100%);
}
</style>
