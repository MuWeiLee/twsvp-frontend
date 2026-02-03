import { supabase } from "./supabase";

export const STRATEGY_IDS = [
  "fixed_5w_aggressive",
  "fixed_5w_low_vol",
  "fixed_5w_income",
  "fixed_5w_steady",
  "fixed_20w_aggressive",
  "fixed_20w_low_vol",
  "fixed_20w_income",
  "fixed_20w_steady",
  "fixed_50w_aggressive",
  "fixed_50w_low_vol",
  "fixed_50w_income",
  "fixed_50w_steady",
];

export const STRATEGY_LABELS = {
  fixed_5w_aggressive: "F5-AG",
  fixed_5w_low_vol: "F5-LV",
  fixed_5w_income: "F5-IN",
  fixed_5w_steady: "F5-ST",
  fixed_20w_aggressive: "F20-AG",
  fixed_20w_low_vol: "F20-LV",
  fixed_20w_income: "F20-IN",
  fixed_20w_steady: "F20-ST",
  fixed_50w_aggressive: "F50-AG",
  fixed_50w_low_vol: "F50-LV",
  fixed_50w_income: "F50-IN",
  fixed_50w_steady: "F50-ST",
};

export const fetchLatestStrategyRuns = async (limit = 30) => {
  const { data, error } = await supabase
    .from("strategy_runs")
    .select("run_id,strategy_id,risk_level,week_end,metrics")
    .order("week_end", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("读取 strategy_runs 失败:", error);
    return [];
  }
  return data || [];
};

export const fetchStrategySignalsByWeekEnds = async (weekEnds = [], strategyIds = []) => {
  if (!weekEnds.length) return [];
  let query = supabase
    .from("strategy_signals")
    .select("strategy_id,week_end,stock_id,target_weight,score")
    .in("week_end", weekEnds);
  if (strategyIds.length) {
    query = query.in("strategy_id", strategyIds);
  }
  const { data, error } = await query;
  if (error) {
    console.error("读取 strategy_signals 失败:", error);
    return [];
  }
  return data || [];
};

export const fetchStrategyDailyPerformance = async (strategyIds = [], limit = 200) => {
  if (!strategyIds.length) return [];
  const { data, error } = await supabase
    .from("strategy_daily_performance")
    .select("strategy_id,trade_date,daily_return,cumulative_return,holdings_count,weight_sum")
    .in("strategy_id", strategyIds)
    .order("trade_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("读取 strategy_daily_performance 失败:", error);
    return [];
  }
  return data || [];
};

export const fetchStrategySignals = async (weekEnd, strategyIds = []) => {
  if (!weekEnd) return [];
  let query = supabase
    .from("strategy_signals")
    .select("strategy_id,stock_id,target_weight,score")
    .eq("week_end", weekEnd);
  if (strategyIds.length) {
    query = query.in("strategy_id", strategyIds);
  }
  const { data, error } = await query;
  if (error) {
    console.error("读取 strategy_signals 失败:", error);
    return [];
  }
  return data || [];
};

export const fetchStockNames = async (stockIds = []) => {
  if (!stockIds.length) return {};
  const { data, error } = await supabase
    .from("stocks")
    .select("stock_id,name")
    .in("stock_id", stockIds);
  if (error) {
    console.error("读取 stocks 失败:", error);
    return {};
  }
  const map = {};
  (data || []).forEach((row) => {
    map[row.stock_id] = row.name;
  });
  return map;
};

export const fetchStockPricesByDates = async (stockIds = [], tradeDates = []) => {
  if (!stockIds.length || !tradeDates.length) return [];
  const { data, error } = await supabase
    .from("stock_prices")
    .select("stock_id,trade_date,open,close")
    .in("stock_id", stockIds)
    .in("trade_date", tradeDates);
  if (error) {
    console.error("读取 stock_prices 失败:", error);
    return [];
  }
  return data || [];
};

export const fetchStockPricesByRange = async (stockIds = [], startDate, endDate) => {
  if (!stockIds.length || !startDate || !endDate) return [];
  const { data, error } = await supabase
    .from("stock_prices")
    .select("stock_id,trade_date,open,close")
    .in("stock_id", stockIds)
    .gte("trade_date", startDate)
    .lte("trade_date", endDate)
    .order("trade_date", { ascending: false });
  if (error) {
    console.error("读取 stock_prices 失败:", error);
    return [];
  }
  return data || [];
};

export const fetchStockPriceSnapshots = async (stockIds = [], limitRows = 2000) => {
  if (!stockIds.length) return {};
  const { data, error } = await supabase
    .from("stock_prices")
    .select("stock_id,trade_date,open,close")
    .in("stock_id", stockIds)
    .order("trade_date", { ascending: false })
    .limit(limitRows);
  if (error) {
    console.error("读取 stock_prices 失败:", error);
    return {};
  }
  const map = {};
  (data || []).forEach((row) => {
    if (!map[row.stock_id]) map[row.stock_id] = [];
    map[row.stock_id].push(row);
  });
  const snapshots = {};
  Object.entries(map).forEach(([stockId, rows]) => {
    const sorted = rows
      .slice()
      .sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)));
    snapshots[stockId] = {
      latest: sorted[0] || null,
      prev: sorted[1] || null,
    };
  });
  return snapshots;
};

export const runStrategyBacktest = async ({
  strategyIds = [],
  startDate,
  lookback,
  liquidityTop,
  maxPicks,
  dryRun,
  cleanOld,
} = {}) => {
  const payload = {
    strategy_ids: strategyIds,
    start_date: startDate,
    lookback,
    liquidity_top: liquidityTop,
    max_picks: maxPicks,
    dry_run: dryRun ? 1 : 0,
    clean_old: cleanOld === false ? 0 : 1,
  };
  const response = await fetch("/api/backtest-strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = "回测请求失败";
    try {
      const errorBody = await response.json();
      message = errorBody?.error || message;
    } catch (error) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json();
};
