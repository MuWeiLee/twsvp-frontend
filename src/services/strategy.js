import { supabase } from "./supabase";

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
