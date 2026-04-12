import { ref } from "vue";

const toastMessage = ref("");
const toastType = ref("info"); // 'info' | 'error' | 'success'
const toastVisible = ref(false);
let toastTimer = null;

export function showToast(message, type = "info", duration = 2800) {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, duration);
}

export { toastMessage, toastType, toastVisible };
