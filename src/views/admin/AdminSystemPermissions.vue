<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>权限管理</h2>
      <p class="muted">权限类型与范围按规则约束，特定权限需配置对象</p>
    </div>

    <div class="table">
      <div class="table-row table-head">
        <span>权限类型</span>
        <span>权限内容</span>
        <span>关联用户(email)</span>
        <span>更多</span>
      </div>
      <div v-for="row in rows" :key="row.permission_id" class="table-row">
        <span>{{ typeLabel(row.permission_type) }}</span>
        <span class="pill">{{ scopeLabel(row.permission_scope) }}</span>
        <span class="cell-content">
          <template v-if="row.permission_scope === 'specific'">
            <span v-if="row.target_emails?.length">
              {{ row.target_emails.join(", ") }}
            </span>
            <span v-else-if="row.target_codes?.length">
              {{ row.target_codes.join(", ") }}
            </span>
            <span v-else>未配置</span>
          </template>
          <span v-else>—</span>
        </span>
        <button class="more-btn" type="button" @click="openSheet(row)">⋯</button>
      </div>
    </div>

    <button class="primary-btn" type="button" @click="openSheet()">新增权限</button>

    <div v-if="status" class="status">{{ status }}</div>

    <AdminActionSheet
      :open="sheetOpen"
      title="权限操作"
      :safe-actions="safeActions"
      :danger-actions="[]"
      @close="closeSheet"
      @action="handleAction"
    />

    <div v-if="editOpen" class="drawer-backdrop" @click.self="closeEdit">
      <div class="drawer">
        <div class="drawer-header">
          <span>编辑权限</span>
          <button type="button" @click="closeEdit">关闭</button>
        </div>
        <div class="form-row">
          <label>权限类型</label>
          <select v-model="form.permission_type" class="select">
            <option v-for="item in permissionTypes" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </div>
        <div class="form-row">
          <label>权限内容</label>
          <select v-model="form.permission_scope" class="select">
            <option v-for="item in permissionScopes" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </div>
        <div v-if="showCodes" class="form-row">
          <label>允许个股代码列表</label>
          <input
            v-model="codeQuery"
            class="input"
            type="text"
            placeholder="搜索个股代码或名称"
            @input="searchCodes"
          />
          <div class="chip-list">
            <button
              v-for="stock in codeResults"
              :key="stock.stock_id"
              type="button"
              class="chip"
              @click="addCode(stock)"
            >
              {{ stock.name }} ({{ stock.stock_id }})
            </button>
          </div>
          <div class="chip-list selected">
            <span v-if="!form.target_codes.length" class="chip muted">未选择</span>
            <button
              v-for="code in form.target_codes"
              :key="code"
              type="button"
              class="chip selected"
              @click="removeCode(code)"
            >
              {{ code }} ✕
            </button>
          </div>
        </div>
        <div v-if="showEmails" class="form-row">
          <label>允许用户列表</label>
          <input
            v-model="emailQuery"
            class="input"
            type="text"
            placeholder="搜索用户邮箱"
            @input="searchEmails"
          />
          <div class="chip-list">
            <button
              v-for="user in emailResults"
              :key="user.user_id"
              type="button"
              class="chip"
              @click="addEmail(user)"
            >
              {{ user.email || user.nickname }}
            </button>
          </div>
          <div class="chip-list selected">
            <span v-if="!form.target_emails.length" class="chip muted">未选择</span>
            <button
              v-for="email in form.target_emails"
              :key="email"
              type="button"
              class="chip selected"
              @click="removeEmail(email)"
            >
              {{ email }} ✕
            </button>
          </div>
        </div>
        <button class="save-btn" type="button" @click="savePermission">保存</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AdminActionSheet from "../../components/admin/AdminActionSheet.vue";
import { fetchPermissions, searchUsersByEmail, upsertPermission } from "../../services/admin";
import { searchStocksSupabase } from "../../services/stocks";

const rows = ref([]);
const status = ref("");
const sheetOpen = ref(false);
const editOpen = ref(false);
const activeRow = ref(null);
const codeQuery = ref("");
const emailQuery = ref("");
const codeResults = ref([]);
const emailResults = ref([]);

const permissionTypes = [
  { value: "views", label: "观点" },
  { value: "comments", label: "留言" },
  { value: "articles", label: "资讯" },
  { value: "stocks", label: "个股" },
  { value: "stock_detail", label: "个股详情" },
  { value: "system", label: "系统管理" },
];

const permissionScopes = [
  { value: "all", label: "全量" },
  { value: "specific", label: "特定" },
  { value: "deny", label: "禁止" },
];

const form = reactive({
  permission_id: null,
  permission_type: "views",
  permission_scope: "all",
  target_codes: [],
  target_emails: [],
});

const typeLabel = (value) =>
  permissionTypes.find((item) => item.value === value)?.label || "—";
const scopeLabel = (value) =>
  permissionScopes.find((item) => item.value === value)?.label || "—";

const safeActions = computed(() => [
  {
    label: "编辑权限",
    action: "edit",
  },
]);

const allowSpecificUsers = computed(() =>
  ["views", "comments"].includes(form.permission_type)
);
const allowSpecificStocks = computed(() =>
  ["stocks", "stock_detail"].includes(form.permission_type)
);
const showCodes = computed(() => form.permission_scope === "specific" && allowSpecificStocks.value);
const showEmails = computed(() =>
  form.permission_scope === "specific" && allowSpecificUsers.value
);

const openSheet = (row = null) => {
  activeRow.value = row;
  sheetOpen.value = true;
};

const closeSheet = () => {
  sheetOpen.value = false;
};

const handleAction = (action) => {
  if (action.action !== "edit") return;
  const row = activeRow.value;
  if (row) {
    Object.assign(form, {
      permission_id: row.permission_id,
      permission_type: row.permission_type,
      permission_scope: row.permission_scope,
      target_codes: row.target_codes || [],
      target_emails: row.target_emails || [],
    });
  } else {
    Object.assign(form, {
      permission_id: null,
      permission_type: "views",
      permission_scope: "all",
      target_codes: [],
      target_emails: [],
    });
  }
  codeQuery.value = "";
  emailQuery.value = "";
  codeResults.value = [];
  emailResults.value = [];
  editOpen.value = true;
  closeSheet();
};

const closeEdit = () => {
  editOpen.value = false;
};

const searchCodes = async () => {
  if (!codeQuery.value.trim()) {
    codeResults.value = [];
    return;
  }
  codeResults.value = await searchStocksSupabase(codeQuery.value, 6);
};

const searchEmails = async () => {
  if (!emailQuery.value.trim()) {
    emailResults.value = [];
    return;
  }
  emailResults.value = await searchUsersByEmail(emailQuery.value);
};

const addCode = (stock) => {
  if (!form.target_codes.includes(stock.stock_id)) {
    form.target_codes.push(stock.stock_id);
  }
};

const removeCode = (code) => {
  form.target_codes = form.target_codes.filter((item) => item !== code);
};

const addEmail = (user) => {
  const email = user.email || "";
  if (email && !form.target_emails.includes(email)) {
    form.target_emails.push(email);
  }
};

const removeEmail = (email) => {
  form.target_emails = form.target_emails.filter((item) => item !== email);
};

const savePermission = async () => {
  status.value = "保存中...";
  const payload = {
    permission_id: form.permission_id || crypto.randomUUID(),
    permission_type: form.permission_type,
    permission_scope: form.permission_scope,
    target_codes: showCodes.value ? form.target_codes : [],
    target_emails: showEmails.value ? form.target_emails : [],
    updated_at: new Date().toISOString(),
  };
  await upsertPermission(payload);
  editOpen.value = false;
  await loadRows();
  status.value = "";
};

const loadRows = async () => {
  status.value = "加载中...";
  rows.value = await fetchPermissions();
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
  grid-template-columns: 1fr 0.8fr 1.4fr 0.4fr;
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

.cell-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill {
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
}

.primary-btn {
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
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

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 20, 25, 0.3);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 45;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}

.drawer {
  width: min(440px, 100%);
  background: var(--surface);
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}

.drawer-header button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.select,
.input {
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 8px 10px;
  font-size: 13px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  border-radius: 999px;
  border: 1px solid var(--border);
  padding: 2px 8px;
  background: var(--surface);
  font-size: 11px;
}

.chip.selected {
  background: var(--accent-soft);
}

.chip.muted {
  color: var(--muted);
}

.save-btn {
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
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
