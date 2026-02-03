import { runBacktest } from "./backtest_strategies.js";

const TARGET_STRATEGIES = [
  "tw_stock_only_acceleration_v1",
  "tw_acceleration_weighted_v1",
  "tw_acceleration_monitor_v1",
];

const formatPercent = (value) => {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}%`;
};

const groupByStrategy = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.strategy_id)) {
      map.set(row.strategy_id, []);
    }
    map.get(row.strategy_id).push(row);
  });
  map.forEach((items) => {
    items.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
  });
  return map;
};

const printSummary = (rows) => {
  const grouped = groupByStrategy(rows);
  grouped.forEach((items, strategyId) => {
    console.log(`\nStrategy: ${strategyId}`);
    console.log("trade_date | daily_return | cumulative_return | holdings");
    items.forEach((item) => {
      const line = [
        item.trade_date,
        formatPercent(item.daily_return),
        formatPercent(item.cumulative_return),
        item.holdings_count ?? "--",
      ].join(" | ");
      console.log(line);
    });
  });
};

const run = async () => {
  const result = await runBacktest({
    strategyIds: TARGET_STRATEGIES,
    dryRun: true,
    collectRows: true,
  });
  const rows = result.dailyRows || [];
  if (!rows.length) {
    console.log("No backtest rows returned. Check data availability.");
    return;
  }
  printSummary(rows);
};

run().catch((error) => {
  console.error("Backtest failed:", error);
  process.exit(1);
});
