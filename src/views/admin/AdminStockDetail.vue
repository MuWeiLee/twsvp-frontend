<template>
  <section class="placeholder">
    <h2>个股详情</h2>
    <p>个股详情管理页面待补充，当前股票代码：{{ code }}</p>
  </section>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const code = computed(() => route.params.code || "—");
</script>

<style scoped>
.placeholder {
  background: var(--surface);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow);
}

.placeholder h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.placeholder p {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
</style>
