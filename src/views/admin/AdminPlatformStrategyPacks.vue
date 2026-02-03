<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>策略包</h2>
      <p class="muted">集中管理策略表现、累积绩效与每日选股记录</p>
    </div>
    <p v-if="statusMessage" class="muted status-message">{{ statusMessage }}</p>

    <div class="strategy-layout">
      <div class="strategy-list">
        <div class="list-header">
          <span>策略名称</span>
          <span>近10天绩效</span>
          <span>风险等级</span>
          <span>展示</span>
        </div>
        <button
          v-for="strategy in strategies"
          :key="strategy.id"
          type="button"
          class="list-row"
          :class="{ active: activeStrategy?.id === strategy.id }"
          @click="selectStrategy(strategy)"
        >
          <span class="name">{{ strategy.name }}</span>
          <span class="return" :class="returnClass(strategy.tenDayReturn)">
            {{ strategy.tenDayReturn }}
          </span>
          <span class="risk">{{ strategy.risk }}</span>
          <label class="visibility-toggle" @click.stop>
            <input
              type="checkbox"
              :checked="strategy.visible"
              @change="toggleVisibility(strategy)"
            />
            <span>{{ strategy.visible ? "开启" : "关闭" }}</span>
          </label>
        </button>
      </div>

      <div v-if="activeStrategy" class="strategy-detail">
        <div class="detail-header">
          <div>
            <div class="title-row">
              <h3>{{ activeStrategy.name }}</h3>
              <button type="button" class="refresh-button" :disabled="isRefreshing" @click="refreshPicks">
                {{ isRefreshing ? "刷新中..." : "刷新选股" }}
              </button>
            </div>
            <p class="muted">策略编号：{{ activeStrategy.id }}</p>
            <div class="tag-row">
              <span class="tag">{{ activeStrategy.risk }}</span>
              <span class="tag">{{ activeStrategy.category }}</span>
              <label class="tag toggle-tag">
                <input
                  type="checkbox"
                  :checked="activeStrategy.visible"
                  @change="toggleVisibility(activeStrategy)"
                />
                <span>前端展示</span>
              </label>
            </div>
          </div>
          <div v-if="activeStrategy.summary?.length" class="summary">
            <div v-for="item in activeStrategy.summary" :key="item.label" class="summary-item">
              <span class="label">{{ item.label }}</span>
              <span class="value" :class="returnClass(item.value)">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>策略绩效</h4>
          <div class="performance-grid">
            <div
              v-for="metric in activeStrategy.cumulative"
              :key="metric.label"
              class="metric-card"
            >
              <span class="label">{{ metric.label }}</span>
              <span class="value" :class="returnClass(metric.value)">
                {{ metric.value }}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <h4>每日选股与绩效</h4>
            <span class="hint">策略选股历史可在此表查看</span>
          </div>
          <div v-if="activeStrategy.daily.length" class="table">
            <div class="table-row table-head">
              <span>日期</span>
              <span>当日选股</span>
              <span>权重合计</span>
              <span>当日绩效</span>
            </div>
            <div
              v-for="row in activeStrategy.daily"
              :key="row.date"
              class="table-row"
            >
              <span>{{ row.date }}</span>
              <div class="picks-table">
                <div class="picks-row picks-head">
                  <span>个股名称 代码</span>
                  <span>昨收</span>
                  <span>今收</span>
                  <span>涨跌幅</span>
                  <span>占比</span>
                </div>
                <div v-for="stock in row.picks" :key="stock.code" class="picks-row">
                  <div class="pick-name">
                    <span>{{ stock.name }}</span>
                    <span class="code">{{ stock.code }}</span>
                  </div>
                  <span>{{ stock.prevClose }}</span>
                  <span>{{ stock.todayClose }}</span>
                  <span class="return" :class="returnClass(stock.change)">{{ stock.change }}</span>
                  <span>{{ stock.weight }}</span>
                </div>
              </div>
              <span class="cell-content">{{ row.stockPerformance }}</span>
              <span class="return" :class="returnClass(row.dailyReturn)">
                {{ row.dailyReturn }}
              </span>
            </div>
          </div>
          <div v-else class="empty-table">暂无每日选股历史。</div>
        </div>
      </div>
    </div>
    <div v-if="!isLoading && !strategies.length" class="empty-state">
      暂无策略数据，请先同步策略数据。
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  STRATEGY_IDS,
  STRATEGY_LABELS,
  fetchLatestStrategyRuns,
  fetchStrategyDailyPerformance,
  fetchStrategySignalsByWeekEnds,
  fetchStrategyVisibility,
  fetchStockPricesByRange,
  fetchStockNames,
  upsertStrategyVisibility,
} from "../../services/strategy.js";
import { t } from "../../services/i18n.js";

const strategies = ref([]);
const activeStrategy = ref(null);
const isLoading = ref(false);
const isRefreshing = ref(false);
const loadError = ref("");
const noticeMessage = ref("");
const visibilityMap = ref(new Map());

const selectStrategy = (strategy) => {
  activeStrategy.value = strategy;
};

const riskLabel = (value) => {
  switch (value) {
    case "aggressive":
      return "高风险";
    case "low_vol":
      return "低风险";
    case "income":
      return "中低风险";
    case "steady":
      return "中风险";
    case "core":
      return "核心";
    default:
      return "—";
  }
};

const categoryLabel = (strategyId) => {
  if (strategyId.startsWith("fixed_5w")) return "短线";
  if (strategyId.startsWith("fixed_20w")) return "中线";
  if (strategyId.startsWith("fixed_50w")) return "长线";
  return "—";
};

const strategyLabel = (strategyId) => STRATEGY_LABELS[strategyId] || strategyId;

const formatNumber = (value, digits = 2) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toFixed(digits);
};

const formatPercentSigned = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${(num * 100).toFixed(2)}%`;
};

const formatPercent = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return `${(num * 100).toFixed(2)}%`;
};

const formatRate = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  if (num <= 1) return `${(num * 100).toFixed(1)}%`;
  return `${num.toFixed(1)}%`;
};

const formatWeight = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  return `${(num * 100).toFixed(1)}%`;
};

const formatChangeFromPrices = (open, close) => {
  const openNum = Number(open);
  const closeNum = Number(close);
  if (Number.isNaN(openNum) || Number.isNaN(closeNum) || openNum === 0) return "—";
  const change = (closeNum - openNum) / openNum;
  return formatPercentSigned(change);
};

const returnClass = (value) => {
  const raw = String(value || "");
  const numeric = Number(raw.replace("%", ""));
  if (Number.isNaN(numeric)) return "";
  if (numeric > 0) return "up";
  if (numeric < 0) return "down";
  return "";
};

const toDateKey = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const shiftDateKey = (dateKey, days) => {
  if (!dateKey) return "";
  const parsed = new Date(dateKey);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return toDateKey(parsed);
};

const sumDailyReturns = (rows) =>
  rows.reduce((sum, row) => sum + (Number(row.daily_return) || 0), 0);

const sumWeights = (signals = []) =>
  signals.reduce((sum, signal) => sum + (Number(signal.target_weight) || 0), 0);

const computeWeightedReturn = ({ signals = [], tradeDate, priceMap }) => {
  if (!signals.length || !tradeDate) return null;
  let total = 0;
  let hasValue = false;
  signals.forEach((signal) => {
    const priceInfo = priceMap.get(`${signal.stock_id}|${tradeDate}`) || {};
    const prevClose = Number(priceInfo.prev?.close);
    const todayClose = Number(priceInfo.current?.close);
    const weight = Number(signal.target_weight);
    if (
      Number.isNaN(prevClose) ||
      Number.isNaN(todayClose) ||
      prevClose === 0 ||
      Number.isNaN(weight)
    ) {
      return;
    }
    const change = (todayClose - prevClose) / prevClose;
    total += change * weight;
    hasValue = true;
  });
  return hasValue ? total : null;
};

const computeRollingReturn = (rows, days) => {
  if (!rows.length) return null;
  const latestDate = rows[0]?.trade_date;
  if (!latestDate) return null;
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffKey = toDateKey(cutoff);
  const filtered = rows.filter((row) => row.trade_date >= cutoffKey);
  return sumDailyReturns(filtered);
};

const toggleVisibility = async (strategy) => {
  if (!strategy?.id) return;
  const next = !strategy.visible;
  const ok = await upsertStrategyVisibility(strategy.id, next);
  if (!ok) {
    noticeMessage.value = "更新展示状态失败。";
    return;
  }
  visibilityMap.value.set(strategy.id, next);
  strategies.value = strategies.value.map((item) =>
    item.id === strategy.id ? { ...item, visible: next } : item
  );
  if (activeStrategy.value?.id === strategy.id) {
    activeStrategy.value = { ...activeStrategy.value, visible: next };
  }
  noticeMessage.value = "展示状态已更新。";
};

const computeYtdReturn = (rows) => {
  if (!rows.length) return null;
  const latestDate = rows[0]?.trade_date;
  if (!latestDate) return null;
  const year = String(latestDate).slice(0, 4);
  const cutoffKey = `${year}-01-01`;
  const filtered = rows.filter((row) => row.trade_date >= cutoffKey);
  return sumDailyReturns(filtered);
};

const loadStrategies = async ({ keepActiveId } = {}) => {
  isLoading.value = true;
  loadError.value = "";
  noticeMessage.value = "";
  try {
    const runs = await fetchLatestStrategyRuns(120);
    const allowed = new Set(STRATEGY_IDS);
    const filteredRuns = runs.filter((row) => allowed.has(row.strategy_id));
    if (!filteredRuns.length) {
      strategies.value = [];
      activeStrategy.value = null;
      return;
    }

    const latestByStrategy = new Map();
    filteredRuns.forEach((run) => {
      const existing = latestByStrategy.get(run.strategy_id);
      if (!existing || run.week_end > existing.week_end) {
        latestByStrategy.set(run.strategy_id, run);
      }
    });

    const strategyIds = Array.from(latestByStrategy.keys());
    const weekEnds = [...new Set(filteredRuns.map((row) => row.week_end))];

    const [dailyRows, signals, visibility] = await Promise.all([
      fetchStrategyDailyPerformance(strategyIds, 200),
      fetchStrategySignalsByWeekEnds(weekEnds, strategyIds),
      fetchStrategyVisibility(STRATEGY_IDS),
    ]);
    visibilityMap.value = visibility;

    const stockIds = [...new Set(signals.map((row) => row.stock_id))];
    const tradeDates = [...new Set(dailyRows.map((row) => row.trade_date))];
    const sortedTradeDates = tradeDates.slice().sort();
    const earliestTradeDate = sortedTradeDates[0] || null;
    const latestTradeDate = sortedTradeDates[sortedTradeDates.length - 1] || null;
    const rangeStart = shiftDateKey(earliestTradeDate, -7);
    const rangeEnd = latestTradeDate || earliestTradeDate;

    const [stockNames, priceRows] = await Promise.all([
      fetchStockNames(stockIds),
      fetchStockPricesByRange(stockIds, rangeStart, rangeEnd),
    ]);

    const priceMap = new Map();
    const priceByStock = new Map();
    priceRows.forEach((row) => {
      if (!priceByStock.has(row.stock_id)) priceByStock.set(row.stock_id, []);
      priceByStock.get(row.stock_id).push(row);
    });
    priceByStock.forEach((rows, stockId) => {
      const sorted = rows
        .slice()
        .sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)));
      sorted.forEach((row, index) => {
        const key = `${stockId}|${row.trade_date}`;
        priceMap.set(key, { current: row, prev: sorted[index + 1] || null });
      });
    });

    const signalsByKey = new Map();
    signals.forEach((row) => {
      const key = `${row.strategy_id}|${row.week_end}`;
      if (!signalsByKey.has(key)) {
        signalsByKey.set(key, []);
      }
      signalsByKey.get(key).push(row);
    });

    const weekEndsByStrategy = new Map();
    filteredRuns.forEach((run) => {
      if (!weekEndsByStrategy.has(run.strategy_id)) {
        weekEndsByStrategy.set(run.strategy_id, new Set());
      }
      weekEndsByStrategy.get(run.strategy_id).add(run.week_end);
    });

    const weekEndLists = new Map();
    weekEndsByStrategy.forEach((set, strategyId) => {
      const list = Array.from(set).sort();
      weekEndLists.set(strategyId, list);
    });

    const dailyByStrategy = new Map();
    dailyRows.forEach((row) => {
      if (!dailyByStrategy.has(row.strategy_id)) {
        dailyByStrategy.set(row.strategy_id, []);
      }
      dailyByStrategy.get(row.strategy_id).push(row);
    });

    dailyByStrategy.forEach((rows) => {
      rows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)));
    });

    const resolveWeekEnd = (strategyId, tradeDate) => {
      const list = weekEndLists.get(strategyId) || [];
      for (let i = 0; i < list.length; i += 1) {
        if (list[i] >= tradeDate) return list[i];
      }
      return list[list.length - 1] || null;
    };

    const packs = STRATEGY_IDS.map((strategyId) => {
      const run = latestByStrategy.get(strategyId);
      if (!run) return null;
      const metrics = run.metrics || {};
      const dailyRowsForStrategy = dailyByStrategy.get(strategyId) || [];
      const tenDayReturn = computeRollingReturn(dailyRowsForStrategy, 10);
      const daily = dailyRowsForStrategy.slice(0, 10).map((row) => {
        const weekEnd = resolveWeekEnd(strategyId, row.trade_date);
        const key = weekEnd ? `${strategyId}|${weekEnd}` : null;
        const picks = key ? signalsByKey.get(key) || [] : [];
        const pickData = picks
          .slice()
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 5)
          .map((pick) => {
            const name = stockNames[pick.stock_id] || pick.stock_id;
            const priceInfo = priceMap.get(`${pick.stock_id}|${row.trade_date}`) || {};
            const prevClose = priceInfo.prev?.close;
            const todayClose = priceInfo.current?.close;
            return {
              name,
              code: pick.stock_id,
              prevClose:
                prevClose !== null && prevClose !== undefined ? Number(prevClose).toFixed(2) : "—",
              todayClose:
                todayClose !== null && todayClose !== undefined ? Number(todayClose).toFixed(2) : "—",
              change: formatChangeFromPrices(prevClose, todayClose),
              weight: formatWeight(pick.target_weight) || "—",
            };
          });
        const weightSum = picks.length ? sumWeights(picks) : null;
        const computedDailyReturn = computeWeightedReturn({
          signals: picks,
          tradeDate: row.trade_date,
          priceMap,
        });
        return {
          date: row.trade_date,
          picks: pickData.length
            ? pickData
            : [
                {
                  name: t("暂无选股"),
                  code: "—",
                  prevClose: "—",
                  todayClose: "—",
                  change: "—",
                  weight: "—",
                },
              ],
          stockPerformance:
            weightSum !== null
              ? formatPercent(weightSum)
              : row.weight_sum !== null && row.weight_sum !== undefined
                ? formatPercent(row.weight_sum)
                : "—",
          dailyReturn:
            computedDailyReturn !== null
              ? formatPercentSigned(computedDailyReturn)
              : row.daily_return !== null
                ? formatPercentSigned(row.daily_return)
                : "—",
        };
      });

      return {
        id: strategyId,
        name: metrics.label || STRATEGY_LABELS[strategyId] || strategyId,
        risk: riskLabel(run.risk_level),
        category: categoryLabel(strategyId),
        tenDayReturn: tenDayReturn !== null ? formatPercentSigned(tenDayReturn) : "—",
        summary: [],
        cumulative: [
          {
            label: "近10天绩效",
            value: tenDayReturn !== null ? formatPercentSigned(tenDayReturn) : "—",
          },
          {
            label: "回撤",
            value: metrics.drawdown !== null ? formatPercentSigned(metrics.drawdown) : "—",
          },
          {
            label: "波动率",
            value: metrics.volatility !== null ? formatPercentSigned(metrics.volatility) : "—",
          },
          {
            label: "夏普率",
            value: metrics.sharpe !== null ? formatNumber(metrics.sharpe, 2) : "—",
          },
        ],
        visible: visibility.get(strategyId) === true,
        daily,
      };
    }).filter(Boolean);

    strategies.value = packs;
    const nextId = keepActiveId || activeStrategy.value?.id;
    activeStrategy.value = packs.find((pack) => pack.id === nextId) || packs[0] || null;
  } catch (error) {
    console.error("加载策略数据失败:", error);
    loadError.value = "策略数据加载失败";
    strategies.value = [];
    activeStrategy.value = null;
  } finally {
    isLoading.value = false;
  }
};

const refreshPicks = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    await loadStrategies({ keepActiveId: activeStrategy.value?.id });
    noticeMessage.value = "选股结果已刷新。";
  } catch (error) {
    console.error("刷新选股失败:", error);
    loadError.value = "刷新选股失败";
  } finally {
    isRefreshing.value = false;
  }
};

const statusMessage = computed(() => {
  if (isLoading.value) return "策略数据加载中...";
  if (loadError.value) return loadError.value;
  if (noticeMessage.value) return noticeMessage.value;
  return "";
});

onMounted(() => {
  loadStrategies();
});
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.muted {
  color: var(--muted);
}

.status-message {
  margin: -8px 0 0;
}

.strategy-layout {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 2fr);
  gap: 20px;
}

.strategy-list {
  background: var(--surface);
  border-radius: 16px;
  padding: 12px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-header {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr 0.6fr 0.6fr;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 8px 10px;
}

.list-row {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr 0.6fr 0.6fr;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.list-row:hover {
  background: rgba(99, 102, 241, 0.08);
}

.list-row.active {
  background: rgba(99, 102, 241, 0.14);
  border-color: rgba(99, 102, 241, 0.4);
}

.list-row .name {
  font-weight: 600;
}

.visibility-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.visibility-toggle input {
  accent-color: var(--accent);
}

.toggle-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.strategy-detail {
  background: var(--surface);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-header h3 {
  margin: 0 0 4px;
  font-size: 18px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-button {
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.4);
  padding: 4px 12px;
  font-size: 12px;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.08);
  cursor: pointer;
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.tag-row {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-item {
  background: rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 8px 12px;
  min-width: 120px;
}

.summary-item .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.summary-item .value {
  font-weight: 600;
  font-size: 14px;
}

.detail-section h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.metric-card {
  background: rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
}

.metric-card .label {
  font-size: 12px;
  color: var(--muted);
}

.metric-card .value {
  font-weight: 600;
  font-size: 15px;
}

.table {
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  overflow: hidden;
}

.table-row {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr 1.6fr 0.6fr;
  gap: 12px;
  padding: 10px 12px;
  font-size: 13px;
  align-items: center;
}

.table-row:nth-child(odd) {
  background: rgba(148, 163, 184, 0.08);
}

.table-row.table-head {
  background: rgba(99, 102, 241, 0.12);
  font-weight: 600;
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cell-content {
  color: var(--muted);
}

.picks-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picks-row {
  display: grid;
  grid-template-columns: 1.6fr repeat(4, 0.7fr);
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.picks-row.picks-head {
  color: var(--muted);
  font-weight: 600;
}

.pick-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pick-name .code {
  font-size: 11px;
  color: var(--muted);
}

.return.up {
  color: var(--price-up);
  font-weight: 600;
}

.return.down {
  color: var(--price-down);
  font-weight: 600;
}

.empty-state,
.empty-table {
  color: var(--muted);
  font-size: 13px;
}

.empty-state {
  padding: 16px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.4);
}

.empty-table {
  padding: 12px 0;
}

@media (max-width: 1024px) {
  .strategy-layout {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
