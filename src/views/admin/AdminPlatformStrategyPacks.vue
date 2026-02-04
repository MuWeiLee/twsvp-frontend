<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>策略包</h2>
      <p class="muted">集中管理策略表现、累积绩效与每日选股记录</p>
    </div>
    <div class="placeholder-card">修复中，敬请期待</div>
  </section>
</template>

<script setup></script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.section-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.muted {
  color: var(--muted);
}

.placeholder-card {
  padding: 16px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  color: var(--muted);
  font-size: 13px;
}
</style>
