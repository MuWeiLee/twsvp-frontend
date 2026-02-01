<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>审计日志</h2>
      <p class="muted">记录重要操作与对象变更</p>
    </div>

    <div class="table">
      <div class="table-row table-head">
        <span>时间</span>
        <span>操作人</span>
        <span>动作</span>
        <span>对象类型</span>
        <span>对象ID</span>
        <span>摘要</span>
      </div>
      <div v-for="row in rows" :key="row.created_at + row.target_id" class="table-row">
        <span>{{ formatTime(row.created_at) }}</span>
        <span>{{ row.actor || "—" }}</span>
        <span class="pill">{{ row.action || "—" }}</span>
        <span>{{ row.target_type || "—" }}</span>
        <span class="cell-id">{{ row.target_id || "—" }}</span>
        <span class="cell-content">{{ row.summary || "—" }}</span>
      </div>
    </div>

    <div v-if="status" class="status">{{ status }}</div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { fetchAuditLogs } from "../../services/admin";

const rows = ref([]);
const status = ref("");

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const loadRows = async () => {
  status.value = "加载中...";
  rows.value = await fetchAuditLogs();
  status.value = "";
};

onMounted(loadRows);
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header h2 {
  margin: 0;
  font-size: 20px;
}

.section-header .muted {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.table {
  display: grid;
  gap: 8px;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 0.7fr 0.7fr 0.8fr 1fr 1.2fr;
  gap: 8px;
  align-items: center;
  background: var(--surface);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  box-shadow: var(--shadow);
}

.table-head {
  background: transparent;
  box-shadow: none;
  font-weight: 600;
  color: var(--muted);
}

.pill {
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  text-align: center;
}

.cell-id {
  font-family: "Manrope", sans-serif;
  font-size: 11px;
  color: var(--muted);
}

.cell-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 520px) {
  .table-row {
    grid-template-columns: 1fr;
  }
  .table-head {
    display: none;
  }
}
</style>
