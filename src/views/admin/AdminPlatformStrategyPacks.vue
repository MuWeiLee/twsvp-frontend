<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>策略包</h2>
      <p class="muted">策略列表、策略详情、每日选股与绩效管理</p>
    </div>

    <div class="workspace">
      <aside class="panel list-panel">
        <div class="list-head">
          <div class="panel-title">策略列表</div>
          <button class="btn primary" type="button" :disabled="saving" @click="openCreateForm">
            新建策略
          </button>
        </div>

        <div class="strategy-list">
          <button
            v-for="item in strategies"
            :key="item.strategy_id"
            type="button"
            class="strategy-item"
            :class="{ active: item.strategy_id === selectedStrategyId }"
            @click="selectStrategy(item.strategy_id)"
          >
            <div class="strategy-item-name">{{ item.name || "未命名策略" }}</div>
            <div class="strategy-item-meta">
              <span>{{ resolveStrategyCode(item) }}</span>
              <span>{{ formatDate(item.updated_at || item.created_at) }}</span>
            </div>
          </button>
          <div v-if="!loading && !strategies.length" class="empty">
            尚无策略，先建立第一条策略。
          </div>
        </div>
      </aside>

      <section class="panel detail-panel">
        <div v-if="!selectedStrategy && !isCreating" class="empty">
          请先从左侧选择策略，或点击「新建策略」。
        </div>

        <template v-else>
          <div class="panel-title">{{ isCreating ? "新建策略" : "策略详情" }}</div>

          <div class="detail-grid">
            <label class="field">
              <span>策略名称</span>
              <input v-model="editForm.name" class="input" type="text" />
            </label>
            <label class="field">
              <span>策略代码</span>
              <input v-model="editForm.code" class="input" type="text" />
            </label>
            <label class="field full">
              <span>描述</span>
              <textarea v-model="editForm.description" class="textarea" rows="2" />
            </label>
            <label class="field full">
              <span>策略参数（JSON）</span>
              <textarea v-model="editForm.paramsText" class="textarea" rows="8" />
            </label>
          </div>

          <div class="actions">
            <button
              class="btn primary"
              type="button"
              :disabled="saving"
              @click="isCreating ? handleCreate : handleSaveEdit"
            >
              {{ isCreating ? "建立策略" : "保存编辑" }}
            </button>
            <button
              v-if="isCreating"
              class="btn"
              type="button"
              :disabled="saving"
              @click="cancelCreateForm"
            >
              取消
            </button>
            <template v-else>
              <button class="btn" type="button" :disabled="saving" @click="handleRename">
                重新命名
              </button>
              <button class="btn danger" type="button" :disabled="saving" @click="handleDelete">
                删除策略
              </button>
            </template>
          </div>

          <template v-if="!isCreating">
            <div class="panel-title">回测任务</div>
          <div class="run-toolbar">
            <button
              class="btn primary"
              type="button"
              :disabled="queueing || saving"
              @click="handleQueueRun"
            >
              {{ queueing ? "触发中..." : "触发回测（60交易日）" }}
            </button>
            <button class="btn" type="button" :disabled="detailsLoading" @click="loadRuns">
              刷新任务
            </button>
            <span class="muted">
              回测区间：{{ backtestWindow.startDate || "—" }} ~ {{ backtestWindow.endDate || "—" }}
            </span>
          </div>
          <div class="run-toolbar">
            <select v-model="activeRunId" class="input run-select" @change="loadRunDetails">
              <option v-for="run in runs" :key="run.run_id" :value="run.run_id">
                {{ run.status }} | {{ run.start_date }} ~ {{ run.end_date }}
              </option>
            </select>
            <span class="muted">{{ runs.length }} 条任务</span>
          </div>

          <div v-if="activeRun" class="run-summary">
            <div>状态：{{ activeRun.status }}</div>
            <div>区间：{{ activeRun.start_date }} ~ {{ activeRun.end_date }}</div>
            <div>总体绩效：{{ formatPercent(summaryPerformance) }}</div>
          </div>

          <div class="table">
            <div class="table-row table-head">
              <span>日期</span>
              <span>每日选股</span>
              <span>个别绩效均值</span>
              <span>当日总体绩效</span>
              <span>累积绩效</span>
            </div>
            <div v-for="row in dailyDetailRows" :key="row.tradeDate" class="table-row">
              <span>{{ row.tradeDate }}</span>
              <span class="cell-picks">{{ row.pickText }}</span>
              <span>{{ formatPercent(row.avgPickReturn) }}</span>
              <span>{{ formatPercent(row.dailyReturn) }}</span>
              <span>{{ formatPercent(row.cumulativeReturn) }}</span>
            </div>
            <div v-if="!detailsLoading && !dailyDetailRows.length" class="empty table-empty">
              当前回测无明细数据。
            </div>
          </div>
          </template>
        </template>
      </section>
    </div>

    <div v-if="status" class="status">{{ status }}</div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  createQuantStrategy,
  deleteQuantStrategy,
  fetchQuantRunDaily,
  fetchQuantRunPicks,
  fetchQuantRunsByStrategy,
  fetchQuantStrategies,
  queueQuantRun,
  resolveBacktestWindow,
  updateQuantStrategy,
  writeAuditLog,
} from "../../services/admin";

const DEFAULT_PARAMS = {
  top_n: 5,
  hold_days: 5,
  momentum_window_short: 3,
  momentum_window_long: 10,
  volume_ma: 10,
  lookback_days: 60,
};

const loading = ref(false);
const detailsLoading = ref(false);
const saving = ref(false);
const status = ref("");
const strategies = ref([]);
const selectedStrategyId = ref("");
const isCreating = ref(false);
const runs = ref([]);
const activeRunId = ref("");
const runDailyRows = ref([]);
const runPickRows = ref([]);
const queueing = ref(false);
const backtestWindow = ref({
  startDate: "",
  endDate: "",
});

const editForm = ref({
  name: "",
  code: "",
  description: "",
  paramsText: JSON.stringify(DEFAULT_PARAMS, null, 2),
});

const selectedStrategy = computed(() =>
  strategies.value.find((item) => item.strategy_id === selectedStrategyId.value) || null
);

const activeRun = computed(
  () => runs.value.find((item) => item.run_id === activeRunId.value) || null
);

const summaryPerformance = computed(() => {
  const summary = activeRun.value?.summary;
  if (!summary || typeof summary !== "object") return null;
  return (
    summary.total_return ??
    summary.cumulative_return ??
    summary.overall_return ??
    summary.performance_pct ??
    null
  );
});

const parseMaybeJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const normalizeParamsObject = (params) => {
  let value = parseMaybeJson(params) || {};
  if (typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  for (let i = 0; i < 2; i += 1) {
    if (typeof value.strategy_code === "string") {
      const nested = parseMaybeJson(value.strategy_code);
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        value = { ...value, ...nested };
        value.strategy_code =
          nested.strategy_code && typeof nested.strategy_code === "string"
            ? nested.strategy_code
            : value.strategy_code;
      }
    }
  }
  return value;
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("zh-TW");
};

const formatPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
};

const resolveStrategyCode = (item) => {
  const params = normalizeParamsObject(item?.params);
  return params.strategy_code || params.code || item?.strategy_id || "—";
};

const slugifyCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "strategy";

const syncEditForm = () => {
  const current = selectedStrategy.value;
  if (!current) return;
  const params = normalizeParamsObject(current.params);
  editForm.value = {
    name: current.name || "",
    code: params.strategy_code || params.code || slugifyCode(current.name),
    description: current.description || "",
    paramsText: JSON.stringify(params, null, 2),
  };
};

const loadStrategies = async () => {
  loading.value = true;
  status.value = "加载策略中...";
  const data = await fetchQuantStrategies();
  strategies.value = data;
  if (selectedStrategyId.value && !data.some((item) => item.strategy_id === selectedStrategyId.value)) {
    selectedStrategyId.value = "";
  }
  loading.value = false;
  status.value = "";
};

const syncBacktestWindow = async () => {
  const params = normalizeParamsObject(selectedStrategy.value?.params);
  const lookbackDays = Number(params.lookback_days || 60);
  backtestWindow.value = await resolveBacktestWindow(lookbackDays);
};

const selectStrategy = async (strategyId) => {
  isCreating.value = false;
  selectedStrategyId.value = strategyId;
  syncEditForm();
  await syncBacktestWindow();
  await loadRuns();
};

const openCreateForm = () => {
  isCreating.value = true;
  selectedStrategyId.value = "";
  runs.value = [];
  activeRunId.value = "";
  runDailyRows.value = [];
  runPickRows.value = [];
  editForm.value = {
    name: "",
    code: "",
    description: "",
    paramsText: JSON.stringify(DEFAULT_PARAMS, null, 2),
  };
  resolveBacktestWindow(60).then((window) => {
    backtestWindow.value = window;
  });
};

const cancelCreateForm = () => {
  isCreating.value = false;
  if (strategies.value.length) {
    selectStrategy(strategies.value[0].strategy_id);
  }
};

const loadRuns = async () => {
  if (!selectedStrategyId.value) {
    runs.value = [];
    activeRunId.value = "";
    runDailyRows.value = [];
    runPickRows.value = [];
    return;
  }
  detailsLoading.value = true;
  const runRows = await fetchQuantRunsByStrategy(selectedStrategyId.value);
  runs.value = runRows;
  activeRunId.value = runRows[0]?.run_id || "";
  await loadRunDetails();
  detailsLoading.value = false;
};

const loadRunDetails = async () => {
  if (!activeRunId.value) {
    runDailyRows.value = [];
    runPickRows.value = [];
    return;
  }
  detailsLoading.value = true;
  const [dailyRows, pickRows] = await Promise.all([
    fetchQuantRunDaily(activeRunId.value),
    fetchQuantRunPicks(activeRunId.value),
  ]);
  runDailyRows.value = dailyRows;
  runPickRows.value = pickRows;
  detailsLoading.value = false;
};

const parseParamsText = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return { ...DEFAULT_PARAMS };
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("策略参数必须是 JSON 对象");
  }
  return parsed;
};

const handleCreate = async () => {
  const name = editForm.value.name.trim();
  if (!name) {
    status.value = "策略名称不能为空";
    return;
  }
  let params;
  try {
    params = parseParamsText(editForm.value.paramsText);
  } catch (error) {
    status.value = error.message || "参数 JSON 格式错误";
    return;
  }
  const code = editForm.value.code.trim() || slugifyCode(name);
  saving.value = true;
  status.value = "创建策略中...";
  params.strategy_code = code;
  const created = await createQuantStrategy({
    name,
    description: editForm.value.description,
    params,
  });
  if (!created) {
    status.value = "创建失败，请检查数据表与权限";
    saving.value = false;
    return;
  }
  await writeAuditLog({
    actor: "admin",
    action: "新增策略",
    targetType: "quant_strategy",
    targetId: created.strategy_id,
    summary: `${created.name} (${code})`.slice(0, 60),
  });
  await loadStrategies();
  isCreating.value = false;
  selectedStrategyId.value = created.strategy_id;
  syncEditForm();
  await syncBacktestWindow();
  await loadRuns();
  status.value = "策略已建立";
  saving.value = false;
};

const handleSaveEdit = async () => {
  if (!selectedStrategy.value) return;
  let params;
  try {
    params = parseParamsText(editForm.value.paramsText);
  } catch (error) {
    status.value = error.message || "参数 JSON 格式错误";
    return;
  }
  const code = editForm.value.code.trim() || slugifyCode(editForm.value.name);
  params.strategy_code = code;
  saving.value = true;
  status.value = "保存中...";
  const updated = await updateQuantStrategy(selectedStrategy.value.strategy_id, {
    name: editForm.value.name,
    description: editForm.value.description,
    params,
  });
  if (!updated) {
    status.value = "保存失败";
    saving.value = false;
    return;
  }
  await writeAuditLog({
    actor: "admin",
    action: "编辑策略",
    targetType: "quant_strategy",
    targetId: updated.strategy_id,
    summary: `${updated.name} (${code})`.slice(0, 60),
  });
  await loadStrategies();
  selectedStrategyId.value = updated.strategy_id;
  syncEditForm();
  await syncBacktestWindow();
  status.value = "保存完成";
  saving.value = false;
};

const handleRename = async () => {
  if (!selectedStrategy.value) return;
  const renamed = editForm.value.name.trim();
  if (!renamed) {
    status.value = "名称不能为空";
    return;
  }
  saving.value = true;
  status.value = "重新命名中...";
  const updated = await updateQuantStrategy(selectedStrategy.value.strategy_id, {
    name: renamed,
  });
  if (!updated) {
    status.value = "重新命名失败";
    saving.value = false;
    return;
  }
  await writeAuditLog({
    actor: "admin",
    action: "重命名策略",
    targetType: "quant_strategy",
    targetId: updated.strategy_id,
    summary: `${selectedStrategy.value.name} -> ${renamed}`.slice(0, 60),
  });
  await loadStrategies();
  selectedStrategyId.value = updated.strategy_id;
  syncEditForm();
  await syncBacktestWindow();
  status.value = "重命名完成";
  saving.value = false;
};

const handleDelete = async () => {
  if (!selectedStrategy.value) return;
  const yes = window.confirm(`确认删除策略「${selectedStrategy.value.name}」？`);
  if (!yes) return;
  saving.value = true;
  status.value = "删除中...";
  const ok = await deleteQuantStrategy(selectedStrategy.value.strategy_id);
  if (!ok) {
    status.value = "删除失败";
    saving.value = false;
    return;
  }
  await writeAuditLog({
    actor: "admin",
    action: "删除策略",
    targetType: "quant_strategy",
    targetId: selectedStrategy.value.strategy_id,
    summary: selectedStrategy.value.name?.slice(0, 60) || "strategy",
  });
  const deletedId = selectedStrategy.value.strategy_id;
  await loadStrategies();
  if (selectedStrategyId.value === deletedId) {
    selectedStrategyId.value = strategies.value[0]?.strategy_id || "";
  }
  syncEditForm();
  if (selectedStrategyId.value) {
    await syncBacktestWindow();
  }
  await loadRuns();
  status.value = "删除完成";
  saving.value = false;
};

const handleQueueRun = async () => {
  if (!selectedStrategy.value) return;
  queueing.value = true;
  status.value = "创建回测任务中...";
  const run = await queueQuantRun({
    strategyId: selectedStrategy.value.strategy_id,
    startDate: backtestWindow.value.startDate,
    endDate: backtestWindow.value.endDate,
  });
  if (!run) {
    status.value = "创建回测任务失败";
    queueing.value = false;
    return;
  }
  await writeAuditLog({
    actor: "admin",
    action: "触发回测",
    targetType: "quant_run",
    targetId: run.run_id,
    summary: `${selectedStrategy.value.name} ${run.start_date}~${run.end_date}`.slice(0, 60),
  });
  await loadRuns();
  activeRunId.value = run.run_id;
  await loadRunDetails();
  status.value = "回测任务已入队";
  queueing.value = false;
};

const dailyDetailRows = computed(() => {
  const dailyMap = new Map();

  runDailyRows.value.forEach((row) => {
    if (!row.trade_date) return;
    dailyMap.set(row.trade_date, {
      tradeDate: row.trade_date,
      picks: [],
      pickReturns: [],
      dailyReturn: row.daily_return ?? null,
      cumulativeReturn: row.cumulative_return ?? null,
    });
  });

  runPickRows.value.forEach((row) => {
    const tradeDate = row.trade_date || row.date || row.pick_date;
    if (!tradeDate) return;
    if (!dailyMap.has(tradeDate)) {
      dailyMap.set(tradeDate, {
        tradeDate,
        picks: [],
        pickReturns: [],
        dailyReturn: null,
        cumulativeReturn: null,
      });
    }
    const item = dailyMap.get(tradeDate);
    const stockId = row.stock_id || row.symbol || row.code || row.ticker || "";
    const stockName = row.stock_name || row.name || "";
    const label = [stockName, stockId].filter(Boolean).join(" ");
    if (label) item.picks.push(label.trim());
    const perf = Number(
      row.return_pct ?? row.performance_pct ?? row.stock_return ?? row.holding_return ?? NaN
    );
    if (Number.isFinite(perf)) item.pickReturns.push(perf);
  });

  return Array.from(dailyMap.values())
    .map((item) => {
      const avgPickReturn = item.pickReturns.length
        ? item.pickReturns.reduce((sum, value) => sum + value, 0) / item.pickReturns.length
        : null;
      return {
        tradeDate: item.tradeDate,
        pickText: item.picks.length ? item.picks.join("、") : "—",
        avgPickReturn,
        dailyReturn: item.dailyReturn,
        cumulativeReturn: item.cumulativeReturn,
      };
    })
    .sort((a, b) => String(b.tradeDate).localeCompare(String(a.tradeDate)));
});

onMounted(async () => {
  await loadStrategies();
  if (strategies.value.length) {
    await selectStrategy(strategies.value[0].strategy_id);
  }
});
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
}

.section-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.muted {
  color: var(--muted);
}

.workspace {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 12px;
}

.panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.strategy-list {
  display: grid;
  gap: 8px;
  max-height: 640px;
  overflow: auto;
}

.strategy-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  padding: 8px;
  text-align: left;
}

.strategy-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.strategy-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.strategy-item-meta {
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.field.full {
  grid-column: 1 / -1;
}

.input,
.textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}

.textarea {
  resize: vertical;
}

.actions {
  margin: 12px 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--bg);
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--ink);
  color: #fff;
  border-color: var(--ink);
}

.btn.danger {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.25);
}

.run-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.run-select {
  max-width: 360px;
}

.run-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

.table {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
}

.table-row {
  display: grid;
  grid-template-columns: 110px 1fr 120px 120px 120px;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  min-width: 760px;
}

.table-row:last-child {
  border-bottom: 0;
}

.table-head {
  background: var(--accent-soft);
  font-weight: 600;
}

.cell-picks {
  color: var(--ink);
}

.empty {
  color: var(--muted);
  font-size: 12px;
}

.table-empty {
  padding: 10px;
}

.status {
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .strategy-list {
    max-height: 260px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .run-summary {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: 110px 1fr 100px 100px 100px;
    font-size: 11px;
  }
}
</style>
