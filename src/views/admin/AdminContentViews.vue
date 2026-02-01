<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>观点管理</h2>
      <p class="muted">按发布时间排序，展示最新观点</p>
    </div>

    <div class="table">
      <div class="table-row table-head">
        <span>观点id</span>
        <span>用户昵称</span>
        <span>个股名称</span>
        <span>个股代码</span>
        <span>观点内容</span>
        <span>看法</span>
        <span>时效</span>
        <span>发布时间</span>
        <span>更多</span>
      </div>
      <div v-for="row in rows" :key="row.feed_id" class="table-row">
        <span class="cell-id">{{ row.feed_id }}</span>
        <span>{{ row.users?.nickname || "用户" }}</span>
        <span>{{ row.target_name || "—" }}</span>
        <span>{{ row.target_symbol || "—" }}</span>
        <span class="cell-content">{{ row.content || "—" }}</span>
        <span class="cell-pill">{{ directionLabel(row.direction) }}</span>
        <span class="cell-pill">{{ horizonLabel(row.horizon) }}</span>
        <span>{{ formatTime(row.created_at) }}</span>
        <button class="more-btn" type="button" @click="openSheet(row)">⋯</button>
      </div>
    </div>

    <div v-if="status" class="status">{{ status }}</div>

    <AdminActionSheet
      :open="sheetOpen"
      title="更多操作"
      :safe-actions="safeActions"
      :danger-actions="dangerActions"
      @close="closeSheet"
      @action="handleAction"
    />

    <AdminConfirmDialog
      :open="confirmOpen"
      :message="confirmMessage"
      @close="closeConfirm"
      @confirm="confirmDangerAction"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import AdminActionSheet from "../../components/admin/AdminActionSheet.vue";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog.vue";
import {
  banUser,
  fetchContentViews,
  hideRecord,
  writeAuditLog,
} from "../../services/admin";

const rows = ref([]);
const status = ref("");
const sheetOpen = ref(false);
const activeRow = ref(null);
const confirmOpen = ref(false);
const pendingDanger = ref(null);
const confirmMessage = ref("该操作不可撤销，确定继续吗？");

const directionLabel = (value) => {
  if (value === "long") return "看多";
  if (value === "short") return "看空";
  return "中性";
};

const horizonLabel = (value) => {
  const map = {
    ultra_short: "极短期",
    short: "短期",
    medium: "中期",
    long: "长期",
  };
  return map[value] || "—";
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const safeActions = computed(() => [
  {
    label: "查看用户资料",
    action: "view-user",
  },
]);

const dangerActions = computed(() => [
  {
    label: "封禁账号",
    action: "ban-user",
  },
  {
    label: "隐藏观点",
    action: "hide-feed",
  },
]);

const openSheet = (row) => {
  activeRow.value = row;
  sheetOpen.value = true;
};

const closeSheet = () => {
  sheetOpen.value = false;
};

const openConfirm = (action) => {
  pendingDanger.value = action;
  confirmOpen.value = true;
  confirmMessage.value =
    action === "ban-user"
      ? "确认封禁该账号并记录审计日志？"
      : "确认隐藏该观点并记录审计日志？";
};

const closeConfirm = () => {
  confirmOpen.value = false;
  pendingDanger.value = null;
};

const handleAction = (action) => {
  if (!activeRow.value) return;
  if (action.action === "view-user") {
    window.alert(`用户ID：${activeRow.value.user_id}`);
    closeSheet();
    return;
  }
  openConfirm(action.action);
};

const confirmDangerAction = async () => {
  if (!activeRow.value || !pendingDanger.value) return;
  const row = activeRow.value;
  status.value = "处理中...";
  if (pendingDanger.value === "ban-user") {
    await banUser(row.user_id);
    await writeAuditLog({
      actor: "admin",
      action: "封禁账号",
      targetType: "user",
      targetId: row.user_id,
      summary: row.users?.nickname || "用户",
    });
  }
  if (pendingDanger.value === "hide-feed") {
    await hideRecord({ table: "feeds", idField: "feed_id", id: row.feed_id });
    await writeAuditLog({
      actor: "admin",
      action: "隐藏观点",
      targetType: "feed",
      targetId: row.feed_id,
      summary: row.content?.slice(0, 40) || "观点",
    });
  }
  closeConfirm();
  closeSheet();
  await loadRows();
  status.value = "";
};

const loadRows = async () => {
  status.value = "加载中...";
  rows.value = await fetchContentViews();
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
  grid-template-columns: 1.1fr 0.9fr 0.9fr 0.8fr 1.4fr 0.7fr 0.7fr 1fr 0.5fr;
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

.cell-pill {
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 8px;
  text-align: center;
  font-size: 11px;
}

.more-btn {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 2px 6px;
  font-size: 14px;
  cursor: pointer;
}

.status {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 520px) {
  .table-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .table-head {
    display: none;
  }
  .table-row > span,
  .table-row > button {
    justify-self: start;
  }
}
</style>
