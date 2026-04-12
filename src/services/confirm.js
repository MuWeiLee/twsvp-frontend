import { ref } from "vue";

const confirmState = ref(null);

export function showConfirm(message) {
  return new Promise((resolve) => {
    confirmState.value = { message, resolve };
  });
}

export function resolveConfirm(result) {
  if (confirmState.value) {
    confirmState.value.resolve(result);
    confirmState.value = null;
  }
}

export { confirmState };
