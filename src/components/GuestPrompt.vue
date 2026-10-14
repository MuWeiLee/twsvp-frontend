<template>
  <section class="guest-prompt">
    <div class="guest-title">{{ title }}</div>
    <p class="guest-desc">{{ description }}</p>
    <div class="guest-actions">
      <button class="guest-login" type="button" @click="emit('login')">{{ t("登录") }}</button>
      <router-link class="guest-browse" to="/feed">{{ t("先去看观点") }}</router-link>
    </div>
  </section>
</template>

<script setup>
import { t } from "../services/i18n.js";

// 访客打开「我的」「通知」时显示，不强制登录。
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
});

const emit = defineEmits(["login"]);
</script>

<style scoped>
.guest-prompt {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px 18px;
  display: grid;
  gap: 8px;
  text-align: center;
}

.guest-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
}

.guest-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}

.guest-actions {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.guest-login {
  border: none;
  background: var(--accent);
  color: var(--surface);
  border-radius: 999px;
  padding: 9px 28px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.guest-browse {
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
}

.guest-browse:hover {
  color: var(--ink);
}
</style>
