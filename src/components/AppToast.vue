<template>
  <Transition name="toast-fade">
    <div v-if="toastVisible" class="app-toast" :class="toastType" role="alert" aria-live="assertive">
      {{ toastMessage }}
    </div>
  </Transition>
</template>

<script setup>
import { toastMessage, toastType, toastVisible } from "../services/toast.js";
</script>

<style scoped>
.app-toast {
  position: fixed;
  left: 50%;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  max-width: calc(100vw - 48px);
  white-space: nowrap;
  background: var(--ink);
  color: var(--bg);
  font-size: 13px;
  line-height: 1.4;
  padding: 10px 16px;
  border-radius: 999px;
  z-index: 9999;
  pointer-events: none;
  text-align: center;
}

.app-toast.error {
  background: #d32f2f;
  color: #fff;
}

.app-toast.success {
  background: #2e7d32;
  color: #fff;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
