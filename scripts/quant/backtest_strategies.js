import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const toDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return `${value}`.slice(0, 10);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isEtf = (stock) => {
  const stockId = String(stock?.stock_id || "");
  const name = String(stock?.name || "");
  if (stockId.startsWith("00")) return true;
  if (name.toUpperCase().includes("ETF")) return true;
  return false;
};

const percentChange = (a, b) => {
  if (!a || !b || a === 0) return 0;
  return (b - a) / a;
};

const stddev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const rankPercentile = (values) => {
  const n = values.length;
  if (!n) return [];
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && indexed[j].value === indexed[i].value) j += 1;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) {
      ranks[indexed[k].index] = avgRank / n;
    }
    i = j;
  }
  return ranks;
};

const clip = (value, min, max) => Math.max(min, Math.min(max, value));

const computeAccelerationMetrics = (rows) => {
  if (!rows.length) return null;
  const closes = rows.map((r) => r.close);
  const volumes = rows.map((r) => r.volume || 0);
  const idx = rows.length - 1;
  if (idx < 24) return null;
  const close = closes[idx];
  const close5 = closes[idx - 5];
  const close20 = closes[idx - 20];
  if (!close || !close5 || !close20) return null;
  const v5 = (close - close5) / (5 * close5);
  const v20 = (close - close20) / (20 * close20);
  const v5Series = [];
  for (let i = idx - 19; i <= idx; i += 1) {
    const base = closes[i - 5];
    const current = closes[i];
    if (!base || !current) return null;
    v5Series.push((current - base) / (5 * base));
  }
  const v5Sma20 = mean(v5Series);
  if (!v5Sma20) return null;
  const vZ = v5 / v5Sma20;
  const volSlice = volumes.slice(idx - 19, idx + 1);
  const volSma20 = mean(volSlice);
  if (!volSma20) return null;
  const volZ20 = volumes[idx] / volSma20;
  const acc = v5 - v20;
  return {
    v_5: v5,
    v_20: v20,
    acc,
    v_z: vZ,
    vol_z20: volZ20,
  };
};

const computeAccelerationWeightedMetrics = (rows) => {
  if (!rows.length) return null;
  const closes = rows.map((r) => r.close);
  const volumes = rows.map((r) => r.volume || 0);
  const idx = rows.length - 1;
  if (idx < 24) return null;
  const close = closes[idx];
  const close5 = closes[idx - 5];
  const close20 = closes[idx - 20];
  if (!close || !close5 || !close20) return null;
  const v5 = (close - close5) / (5 * close5);
  const v20 = (close - close20) / (20 * close20);

  const v5Series = [];
  const accSeries = [];
  for (let i = idx - 19; i <= idx; i += 1) {
    const base5 = closes[i - 5];
    const base20 = closes[i - 20];
    const current = closes[i];
    if (!base5 || !base20 || !current) return null;
    const v5Day = (current - base5) / (5 * base5);
    const v20Day = (current - base20) / (20 * base20);
    v5Series.push(v5Day);
    accSeries.push(v5Day - v20Day);
  }
  const v5Sma20 = mean(v5Series);
  if (!v5Sma20) return null;
  const vZ = v5 / v5Sma20;

  const volSlice = volumes.slice(idx - 19, idx + 1);
  const volSma20 = mean(volSlice);
  if (!volSma20) return null;
  const volZ20 = volumes[idx] / volSma20;

  const acc = v5 - v20;
  let consec = 0;
  for (let i = accSeries.length - 1; i >= 0; i -= 1) {
    if (accSeries[i] > 0) {
      consec += 1;
    } else {
      break;
    }
    if (consec >= 3) break;
  }
  const ps = Math.min(1, consec / 3);
  const momentum =
    0.35 * clip(v5 / 0.004, 0, 3) +
    0.3 * clip(acc / 0.0015, 0, 3) +
    0.2 * ps +
    0.15 * clip(Math.log(volZ20), 0, 2);

  return {
    v_5: v5,
    v_20: v20,
    acc,
    v_z: vZ,
    vol_z20: volZ20,
    ps,
    momentum,
  };
};

const STRATEGY_CAPITALS = [
  { id: "fixed_5w", name: "固定金额 5万", priceMin: 10, priceMax: 100 },
  { id: "fixed_20w", name: "固定金额 20万", priceMin: 100, priceMax: 500 },
  { id: "fixed_50w", name: "固定金额 50万", priceMin: 500, priceMax: null },
];

const STRATEGY_RISKS = [
  { id: "aggressive", riskLevel: "aggressive" },
  { id: "low_vol", riskLevel: "low_vol" },
  { id: "income", riskLevel: "income" },
  { id: "steady", riskLevel: "steady" },
];

const STRATEGY_LABELS = {
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
  tw_strength_core_v1: "TW强势核心",
  tw_acceleration_monitor_v1: "动能加速",
  tw_acceleration_weighted_v1: "连板策略",
};

const allocateWeights = (scores) => {
  const positives = scores.map((s) => Math.max(0, s));
  const total = positives.reduce((sum, v) => sum + v, 0);
  if (!total) return scores.map(() => 1 / scores.length);
  return positives.map((s) => s / total);
};

const crossZscore = (values) => {
  if (!values.length) return [];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sd = stddev(values);
  if (!sd) return values.map(() => 0);
  return values.map((v) => (v - mean) / sd);
};

const targetScore = (value, target, tolerance) => {
  if (!tolerance) return 0;
  const diff = Math.abs(value - target);
  const score = 1 - diff / tolerance;
  return Math.max(0, Math.min(1, score));
};

const aboveScore = (value, threshold, span) => {
  if (!span) return 0;
  const score = (value - threshold) / span;
  return Math.max(0, Math.min(1, score));
};

const buildProfileScores = (items) => {
  if (!items.length) return;
  const keys = [
    "ret_1",
    "ret_3",
    "ret_5",
    "ret_10",
    "volatility",
    "avg_volume",
    "avg_turnover",
    "avg_range",
    "vol_stability",
    "last_volume",
  ];
  keys.forEach((key) => {
    const values = items.map((item) => item[key] || 0);
    const zs = crossZscore(values);
    items.forEach((item, idx) => {
      item[`${key}_z`] = zs[idx];
    });
  });
  items.forEach((item) => {
    const dailyRet = (item.ret_10 || 0) / 10;
    item.daily_ret = dailyRet;
    item.mid_return_score = targetScore(item.ret_5 || 0, 0.02, 0.01);
    item.low_return_score = targetScore(item.ret_1 || 0, 0.005, 0.005);
    item.high_return_score = aboveScore(item.ret_1 || 0, 0.03, 0.03);
    item.steady_return_score = targetScore(dailyRet, 0.015, 0.005);
    item.momentum_accel = (item.ret_3 || 0) - (item.ret_1 || 0);
  });
};

const mean = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const computeStrengthMetrics = ({ closes, highs, volumes }) => {
  const lastClose = closes[closes.length - 1];
  const close5 = closes.length > 5 ? closes[closes.length - 6] : null;
  const close20 = closes.length > 20 ? closes[closes.length - 21] : null;
  const ret5 = close5 !== null ? percentChange(close5, lastClose) : null;
  const ret20 = close20 !== null ? percentChange(close20, lastClose) : null;
  const highs20 = highs.slice(-20);
  const maxHigh20 = highs20.length === 20 ? Math.max(...highs20) : null;
  const drawdown20 = maxHigh20 ? lastClose / maxHigh20 - 1 : null;
  const volumes20 = volumes.slice(-20);
  const smaVolume20 = volumes20.length === 20 ? mean(volumes20) : null;
  const volumeRatio =
    smaVolume20 && smaVolume20 > 0 ? volumes[volumes.length - 1] / smaVolume20 : null;
  const strengthScore =
    ret20 !== null && ret5 !== null && drawdown20 !== null && volumeRatio !== null
      ? 0.45 * ret20 +
        0.25 * ret5 -
        0.2 * Math.abs(drawdown20) +
        0.1 * Math.log(volumeRatio)
      : null;
  return {
    ret5,
    ret20,
    drawdown20,
    volumeRatio,
    strengthScore,
  };
};

const profileScore = (profileId, item) => {
  if (profileId === "aggressive") {
    return item.high_return_score * 0.5 + item.volatility_z * 0.4 - item.avg_volume_z * 0.3;
  }
  if (profileId === "low_vol") {
    return (
      item.avg_turnover_z * 0.35 +
      item.avg_volume_z * 0.15 +
      item.mid_return_score * 0.35 -
      item.avg_range_z * 0.15
    );
  }
  if (profileId === "income") {
    return (
      item.ret_3_z * 0.3 +
      item.low_return_score * 0.4 -
      item.volatility_z * 0.3 +
      item.momentum_accel * 0.2
    );
  }
  if (profileId === "steady") {
    return (
      item.avg_turnover_z * 0.35 +
      item.avg_volume_z * 0.15 +
      item.steady_return_score * 0.3 -
      item.vol_stability_z * 0.2
    );
  }
  return 0;
};

const inPriceBucket = (price, min, max) => {
  if (price === null || price === undefined) return false;
  if (min !== null && min !== undefined && price < min) return false;
  if (max !== null && max !== undefined && price >= max) return false;
  return true;
};

const buildWeightMap = (signals = []) => {
  const map = new Map();
  signals.forEach((row) => {
    map.set(row.stock_id, row.target_weight || 0);
  });
  return map;
};

const computeTurnover = (prevSignals = [], nextSignals = []) => {
  if (!prevSignals.length && !nextSignals.length) return 0;
  const prevMap = buildWeightMap(prevSignals);
  const nextMap = buildWeightMap(nextSignals);
  const all = new Set([...prevMap.keys(), ...nextMap.keys()]);
  let diffSum = 0;
  all.forEach((key) => {
    diffSum += Math.abs((nextMap.get(key) || 0) - (prevMap.get(key) || 0));
  });
  return diffSum / 2;
};

const extractDelta = (prevSignals = [], nextSignals = []) => {
  const prevMap = buildWeightMap(prevSignals);
  const nextMap = buildWeightMap(nextSignals);
  const added = [];
  const removed = [];
  nextMap.forEach((weight, stockId) => {
    if (!prevMap.has(stockId)) added.push({ stock_id: stockId, weight });
  });
  prevMap.forEach((weight, stockId) => {
    if (!nextMap.has(stockId)) removed.push({ stock_id: stockId, weight });
  });
  return { added, removed };
};

const uniqueSortedDates = (rows = []) => {
  const set = new Set();
  rows.forEach((row) => {
    if (row?.trade_date) set.add(String(row.trade_date));
  });
  return Array.from(set).sort();
};

const collectWindowRows = (rows, startDate, endDate) =>
  rows.filter((row) => row.trade_date >= startDate && row.trade_date <= endDate);

const getLatestTradeDate = async (supabase) => {
  const { data, error } = await supabase
    .from("stock_prices")
    .select("trade_date")
    .order("trade_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(`stock_prices latest trade_date query failed: ${error.message}`);
  return data?.[0]?.trade_date || null;
};

const normalizeStrategyIds = (strategyIds) => {
  if (!strategyIds) return null;
  if (Array.isArray(strategyIds)) {
    return strategyIds.map((id) => String(id).trim()).filter(Boolean);
  }
  return String(strategyIds)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
};

const listStrategyIds = () => [
  ...STRATEGY_CAPITALS.flatMap((capital) =>
    STRATEGY_RISKS.map((risk) => `${capital.id}_${risk.id}`)
  ),
  "tw_strength_core_v1",
  "tw_acceleration_monitor_v1",
  "tw_acceleration_weighted_v1",
];

export const runBacktest = async (options = {}) => {
  const SUPABASE_URL = options.supabaseUrl || requiredEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY =
    options.supabaseServiceRoleKey || requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const startDate = toDateString(options.startDate || process.env.START_DATE || "2026-01-10");
  const lookback = Number(options.lookback ?? process.env.LOOKBACK ?? 20);
  const accelLookback = 30;
  const effectiveLookback = Math.max(lookback, accelLookback);
  const liquidityTop = Number(options.liquidityTop ?? process.env.LIQUIDITY_TOP ?? 500);
  const maxPicks = Math.min(Number(options.maxPicks ?? process.env.MAX_PICKS ?? 5), 5);
  const dryRun = options.dryRun ?? `${process.env.DRY_RUN || ""}` === "1";
  const cleanOld = options.cleanOld ?? `${process.env.CLEAN_OLD || ""}` !== "0";

  const allStrategyIds = listStrategyIds();
  const requestedIds = normalizeStrategyIds(options.strategyIds);
  const validSet = new Set(allStrategyIds);
  const activeStrategyIds = requestedIds
    ? requestedIds.filter((id) => validSet.has(id))
    : allStrategyIds;
  if (!activeStrategyIds.length) {
    throw new Error("No matching strategy ids for backtest");
  }
  const activeSet = new Set(activeStrategyIds);
  const shouldInclude = (strategyId) => activeSet.has(strategyId);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const endDate = toDateString(await getLatestTradeDate(supabase));
  if (!endDate) throw new Error("Unable to determine latest trade_date");

  const { data: stocks, error: stockError } = await supabase
    .from("stocks")
    .select("stock_id,name,is_active")
    .eq("is_active", true)
    .order("stock_id", { ascending: true });
  if (stockError) throw new Error(`stocks query failed: ${stockError.message}`);

  const filteredStocks = (stocks || []).filter((s) => s?.stock_id && !isEtf(s));
  if (!filteredStocks.length) throw new Error("No active stocks found for backtest");

  const referenceStockId = filteredStocks[0].stock_id;
  const { data: refPrices, error: refError } = await supabase
    .from("stock_prices")
    .select("trade_date")
    .eq("stock_id", referenceStockId)
    .gte("trade_date", startDate)
    .lte("trade_date", endDate)
    .order("trade_date", { ascending: true });
  if (refError) throw new Error(`stock_prices reference query failed: ${refError.message}`);

  const tradeDatesAll = uniqueSortedDates(refPrices);
  const tradeDates = tradeDatesAll.slice(-10);
  if (!tradeDates.length) throw new Error("No trade dates found in range");

  const startWithLookback = toDateString(addDays(new Date(startDate), -effectiveLookback - 1));
  const stockIds = filteredStocks.map((s) => s.stock_id);

  const priceMap = new Map();
  const chunkSize = 50;
  for (let i = 0; i < stockIds.length; i += chunkSize) {
    const chunk = stockIds.slice(i, i + chunkSize);
    const { data: prices, error } = await supabase
      .from("stock_prices")
      .select("stock_id,trade_date,close,volume,turnover,high,low")
      .in("stock_id", chunk)
      .gte("trade_date", startWithLookback)
      .lte("trade_date", endDate)
      .order("trade_date", { ascending: true });
    if (error) throw new Error(`stock_prices backtest load failed: ${error.message}`);
    (prices || []).forEach((row) => {
      if (!priceMap.has(row.stock_id)) priceMap.set(row.stock_id, []);
      priceMap.get(row.stock_id).push(row);
    });
  }

  const rollingMap = new Map();
  let prevDayReturns = new Map();
  let latestDayReturns = new Map();
  let latestSignalsPayload = [];
  let latestRunsPayload = [];

  for (let i = 0; i < tradeDates.length; i += 1) {
    const tradeDate = tradeDates[i];
    const windowStart = toDateString(addDays(new Date(tradeDate), -effectiveLookback));

    const stats = [];
    const windowRowsByStock = new Map();
    filteredStocks.forEach((stock) => {
      const rows = priceMap.get(stock.stock_id) || [];
      if (!rows.length) return;
      const windowRows = collectWindowRows(rows, windowStart, tradeDate);
      if (windowRows.length < 2) return;
      const lastRow = windowRows[windowRows.length - 1];
      if (lastRow.trade_date !== tradeDate) return;
      windowRowsByStock.set(stock.stock_id, windowRows);

      const closes = windowRows.map((r) => r.close).filter((v) => v !== null && v !== undefined);
      if (closes.length < 2) return;
      const volumes = windowRows.map((r) => r.volume || 0);
      const turnovers = windowRows.map((r) =>
        r.turnover !== null && r.turnover !== undefined
          ? r.turnover
          : (r.close || 0) * (r.volume || 0)
      );
      const highs = windowRows.map((r) => r.high).filter((v) => v !== null && v !== undefined);
      const lows = windowRows.map((r) => r.low).filter((v) => v !== null && v !== undefined);
      const returns = closes.slice(1).map((v, idx) => percentChange(closes[idx], v));
      const volatility = stddev(returns);
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const avgTurnover = turnovers.reduce((sum, v) => sum + v, 0) / turnovers.length;
      const lastClose = closes[closes.length - 1];
      const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
      const close3 = closes.length > 3 ? closes[closes.length - 4] : closes[0];
      const close5 = closes.length > 5 ? closes[closes.length - 6] : closes[0];
      const close10 = closes.length > 10 ? closes[closes.length - 11] : closes[0];
      const ret1 = percentChange(prevClose, lastClose);
      const ret3 = percentChange(close3, lastClose);
      const ret5 = percentChange(close5, lastClose);
      const ret10 = percentChange(close10, lastClose);
      let avgRange = 0;
      if (highs.length && lows.length && highs.length === lows.length) {
        const ranges = highs.map((h, idx) => {
          const low = lows[idx];
          if (!low) return 0;
          return (h - low) / low;
        });
        avgRange = ranges.reduce((sum, v) => sum + v, 0) / ranges.length;
      }
      const volStd = stddev(volumes);
      const volStability = volStd / (avgVolume + 1e-6);
      const lastVolume = volumes[volumes.length - 1] || 0;
      const strengthMetrics = computeStrengthMetrics({ closes, highs, volumes });
      stats.push({
        stock_id: stock.stock_id,
        name: stock.name || stock.stock_id,
        volatility,
        avg_volume: avgVolume,
        avg_turnover: avgTurnover,
        last_volume: lastVolume,
        ret_1: ret1,
        ret_3: ret3,
        ret_5: ret5,
        ret_10: ret10,
        ret_20: strengthMetrics.ret20,
        drawdown_20: strengthMetrics.drawdown20,
        volume_ratio_20: strengthMetrics.volumeRatio,
        strength_score: strengthMetrics.strengthScore,
        avg_range: avgRange,
        vol_stability: volStability,
        last_close: lastClose,
      });
    });
    stats.sort((a, b) => (b.avg_turnover || 0) - (a.avg_turnover || 0));
    const universe = stats.slice(0, liquidityTop);
    buildProfileScores(universe);

    const dailyRows = [];
    prevDayReturns = new Map(latestDayReturns);
    latestDayReturns = new Map();
    const dailySignalsByStrategy = new Map();

    STRATEGY_CAPITALS.forEach((capital) => {
      const capitalUniverse = universe;
      STRATEGY_RISKS.forEach((risk) => {
        const strategyId = `${capital.id}_${risk.id}`;
        if (!shouldInclude(strategyId)) return;
        capitalUniverse.forEach((item) => {
          item.profile_score = profileScore(risk.id, item);
        });

        const bucketCandidates = capitalUniverse
          .filter((item) =>
            inPriceBucket(item.last_close, capital.priceMin, capital.priceMax)
          )
          .sort((a, b) => (b.profile_score || 0) - (a.profile_score || 0));
        const overallCandidates = [...capitalUniverse].sort(
          (a, b) => (b.profile_score || 0) - (a.profile_score || 0)
        );

        const picks = bucketCandidates.slice(0, 3);
        if (picks.length < 3) {
          overallCandidates.forEach((item) => {
            if (picks.length >= 3) return;
            if (!picks.includes(item)) picks.push(item);
          });
        }
        overallCandidates.forEach((item) => {
          if (picks.length >= maxPicks) return;
          if (!picks.includes(item)) picks.push(item);
        });

        const weights = allocateWeights(picks.map((r) => r.profile_score || 0));
        const signals = [];
        let dailyReturnSum = 0;
        let holdingsCount = 0;
        let weightSum = 0;
        picks.forEach((pick, idx) => {
          const weight = Number(weights[idx].toFixed(6));
          const ret1 = pick.ret_1 ?? null;
          if (ret1 !== null && ret1 !== undefined) {
            dailyReturnSum += ret1;
            holdingsCount += 1;
            weightSum += weight;
          }
          signals.push({
            strategy_id: strategyId,
            risk_level: risk.riskLevel,
            week_end: tradeDate,
            stock_id: pick.stock_id,
            target_weight: weight,
            score: Number((pick.profile_score || 0).toFixed(6)),
            reason: {
              ret_1: pick.ret_1,
              ret_3: pick.ret_3,
              ret_5: pick.ret_5,
              ret_10: pick.ret_10,
              avg_volume: pick.avg_volume,
              avg_turnover: pick.avg_turnover,
              avg_range: pick.avg_range,
              volatility: pick.volatility,
            },
          });
        });

        const dailyReturnValue = holdingsCount
          ? Number((dailyReturnSum / holdingsCount).toFixed(6))
          : null;
        latestDayReturns.set(strategyId, dailyReturnValue);

        const history = rollingMap.get(strategyId) || [];
        if (dailyReturnValue !== null && dailyReturnValue !== undefined) {
          history.unshift(dailyReturnValue);
        }
        const nextHistory = history.slice(0, 10);
        rollingMap.set(strategyId, nextHistory);
        const avgRolling = nextHistory.length
          ? Number(
              (nextHistory.reduce((sum, v) => sum + v, 0) / nextHistory.length).toFixed(6)
            )
          : null;

        dailyRows.push({
          strategy_id: strategyId,
          trade_date: tradeDate,
          daily_return: dailyReturnValue,
          weighted_return: dailyReturnValue,
          cumulative_return: avgRolling,
          holdings_count: holdingsCount,
          weight_sum: Number(weightSum.toFixed(6)),
          source: "backtest",
        });

        dailySignalsByStrategy.set(strategyId, signals);
      });
    });

    const strengthStrategyId = "tw_strength_core_v1";
    if (shouldInclude(strengthStrategyId)) {
      const ret1ByStock = new Map(universe.map((item) => [item.stock_id, item.ret_1]));
      const strengthRows = [];
      universe.forEach((item) => {
        const windowRows = windowRowsByStock.get(item.stock_id);
        if (!windowRows || !windowRows.length) return;
        const idx = windowRows.length - 1;
        const row = windowRows[idx];
        if (!row || !row.volume || row.volume <= 0) return;
        const close = row.close;
        const high = row.high;
        if (close === null || close === undefined || high === null || high === undefined) return;
        const closes = windowRows.map((r) => r.close);
        const highs = windowRows.map((r) => r.high);
        const volumes = windowRows.map((r) => r.volume || 0);
        const ret3 =
          idx >= 3 && closes[idx - 3] !== null && closes[idx - 3] !== undefined
            ? percentChange(closes[idx - 3], close)
            : null;
        const h10Prev = idx >= 10 ? Math.max(...highs.slice(idx - 10, idx)) : null;
        const h5Prev = idx >= 5 ? Math.max(...highs.slice(idx - 5, idx)) : null;
        const volMa10 = idx >= 9 ? mean(volumes.slice(idx - 9, idx + 1)) : null;
        const volZ = volMa10 ? volumes[idx] / volMa10 : null;
        const dd = h5Prev ? close / h5Prev - 1 : null;
        const hhFilter = h10Prev ? (close >= h10Prev ? 1 : 0) : 0;
        const pctChg =
          idx >= 1 && closes[idx - 1] !== null && closes[idx - 1] !== undefined
            ? percentChange(closes[idx - 1], close) * 100
            : null;
        strengthRows.push({
          stock_id: item.stock_id,
          name: item.name || item.stock_id,
          close,
          ret_3: ret3,
          h10_prev: h10Prev,
          h5_prev: h5Prev,
          vol_z: volZ,
          dd,
          HH_Filter: hhFilter,
          pct_chg: pctChg,
        });
      });

      const strengthEligible = strengthRows.filter(
        (row) =>
          row.ret_3 !== null &&
          row.h10_prev !== null &&
          row.h5_prev !== null &&
          row.vol_z !== null
      );

      const ret3Median = median(strengthEligible.map((row) => row.ret_3));
      strengthEligible.forEach((row) => {
        row.RS = row.ret_3 - ret3Median;
      });

      const rsRanks = rankPercentile(strengthEligible.map((row) => row.RS));
      const ddRanks = rankPercentile(strengthEligible.map((row) => row.dd));
      const volRanks = rankPercentile(strengthEligible.map((row) => row.vol_z));

      strengthEligible.forEach((row, idx) => {
        row.score_RS = rsRanks[idx];
        row.score_dd = ddRanks[idx];
        row.score_vol = volRanks[idx];
        if (row.pct_chg !== null && row.pct_chg >= 9.8) {
          row.score_vol = 1.0;
        }
        row.Total_Score =
          (row.score_RS * 0.5 + row.score_vol * 0.3 + row.score_dd * 0.2) *
          row.HH_Filter;
      });

      strengthEligible.sort((a, b) => (b.Total_Score || 0) - (a.Total_Score || 0));
      const strengthPicks = strengthEligible.slice(0, 5);
      const expScores = strengthPicks.map((row) => Math.exp(Math.max(0, row.Total_Score || 0) * 5));
      const expSum = expScores.reduce((sum, v) => sum + v, 0) || 1;
      const strengthSignals = [];
      let strengthReturnSum = 0;
      let strengthHoldings = 0;
      let strengthWeightSum = 0;
      strengthPicks.forEach((pick, idx) => {
        const weight = Number((expScores[idx] / expSum).toFixed(6));
        const ret1 = ret1ByStock.get(pick.stock_id) ?? null;
        if (ret1 !== null && ret1 !== undefined) {
          strengthReturnSum += ret1;
          strengthHoldings += 1;
          strengthWeightSum += weight;
        }
        strengthSignals.push({
          strategy_id: strengthStrategyId,
          risk_level: "core",
          week_end: tradeDate,
          stock_id: pick.stock_id,
          target_weight: weight,
          score: Number((pick.Total_Score || 0).toFixed(6)),
          reason: {
            ret_3: pick.ret_3,
            h10_prev: pick.h10_prev,
            h5_prev: pick.h5_prev,
            vol_z: pick.vol_z,
            dd: pick.dd,
            RS: pick.RS,
          },
        });
      });

      const strengthReturnValue = strengthHoldings
        ? Number((strengthReturnSum / strengthHoldings).toFixed(6))
        : null;
      latestDayReturns.set(strengthStrategyId, strengthReturnValue);

      const history = rollingMap.get(strengthStrategyId) || [];
      if (strengthReturnValue !== null && strengthReturnValue !== undefined) {
        history.unshift(strengthReturnValue);
      }
      const nextHistory = history.slice(0, 10);
      rollingMap.set(strengthStrategyId, nextHistory);
      const avgRolling = nextHistory.length
        ? Number(
            (nextHistory.reduce((sum, v) => sum + v, 0) / nextHistory.length).toFixed(6)
          )
        : null;

      dailyRows.push({
        strategy_id: strengthStrategyId,
        trade_date: tradeDate,
        daily_return: strengthReturnValue,
        weighted_return: strengthReturnValue,
        cumulative_return: avgRolling,
        holdings_count: strengthHoldings,
        weight_sum: Number(strengthWeightSum.toFixed(6)),
        source: "backtest",
      });

      dailySignalsByStrategy.set(strengthStrategyId, strengthSignals);
    }

    const accelStrategyId = "tw_acceleration_monitor_v1";
    if (shouldInclude(accelStrategyId)) {
      const ret1ByStock = new Map(universe.map((item) => [item.stock_id, item.ret_1]));
      const accelRows = [];
      universe.forEach((item) => {
        const windowRows = windowRowsByStock.get(item.stock_id);
        if (!windowRows || !windowRows.length) return;
        const lastRow = windowRows[windowRows.length - 1];
        if (!lastRow || lastRow.trade_date !== tradeDate) return;
        const metrics = computeAccelerationMetrics(windowRows);
        if (!metrics) return;
        accelRows.push({
          stock_id: item.stock_id,
          name: item.name || item.stock_id,
          close: lastRow.close,
          ...metrics,
        });
      });

      const accelCandidates = accelRows.filter(
        (row) => row.v_5 > 0.004 && row.acc > 0.0015 && row.v_z > 1.3 && row.vol_z20 > 1.5
      );
      accelCandidates.sort(
        (a, b) => b.acc * b.vol_z20 - a.acc * a.vol_z20
      );
      const accelPicks = accelCandidates.slice(0, maxPicks);
      const accelWeights = allocateWeights(
        accelPicks.map((row) => row.acc * row.vol_z20)
      );
      const accelSignals = [];
      let accelReturnSum = 0;
      let accelHoldings = 0;
      let accelWeightSum = 0;
      accelPicks.forEach((pick, idx) => {
        const weight = Number(accelWeights[idx].toFixed(6));
        const ret1 = ret1ByStock.get(pick.stock_id) ?? null;
        if (ret1 !== null && ret1 !== undefined) {
          accelReturnSum += ret1;
          accelHoldings += 1;
          accelWeightSum += weight;
        }
        accelSignals.push({
          strategy_id: accelStrategyId,
          risk_level: "core",
          week_end: tradeDate,
          stock_id: pick.stock_id,
          target_weight: weight,
          score: Number((pick.acc * pick.vol_z20).toFixed(6)),
          reason: {
            v_5: pick.v_5,
            v_20: pick.v_20,
            acc: pick.acc,
            v_z: pick.v_z,
            vol_z20: pick.vol_z20,
          },
        });
      });

      const accelReturnValue = accelHoldings
        ? Number((accelReturnSum / accelHoldings).toFixed(6))
        : null;
      latestDayReturns.set(accelStrategyId, accelReturnValue);

      const history = rollingMap.get(accelStrategyId) || [];
      if (accelReturnValue !== null && accelReturnValue !== undefined) {
        history.unshift(accelReturnValue);
      }
      const nextHistory = history.slice(0, 10);
      rollingMap.set(accelStrategyId, nextHistory);
      const avgRolling = nextHistory.length
        ? Number(
            (nextHistory.reduce((sum, v) => sum + v, 0) / nextHistory.length).toFixed(6)
          )
        : null;

      dailyRows.push({
        strategy_id: accelStrategyId,
        trade_date: tradeDate,
        daily_return: accelReturnValue,
        weighted_return: accelReturnValue,
        cumulative_return: avgRolling,
        holdings_count: accelHoldings,
        weight_sum: Number(accelWeightSum.toFixed(6)),
        source: "backtest",
      });

      dailySignalsByStrategy.set(accelStrategyId, accelSignals);
    }

    const weightedStrategyId = "tw_acceleration_weighted_v1";
    if (shouldInclude(weightedStrategyId)) {
      const ret1ByStock = new Map(universe.map((item) => [item.stock_id, item.ret_1]));
      const weightedRows = [];
      universe.forEach((item) => {
        const windowRows = windowRowsByStock.get(item.stock_id);
        if (!windowRows || !windowRows.length) return;
        const lastRow = windowRows[windowRows.length - 1];
        if (!lastRow || lastRow.trade_date !== tradeDate) return;
        const metrics = computeAccelerationWeightedMetrics(windowRows);
        if (!metrics) return;
        weightedRows.push({
          stock_id: item.stock_id,
          name: item.name || item.stock_id,
          close: lastRow.close,
          ...metrics,
        });
      });

      const weightedCandidates = weightedRows.filter(
        (row) => row.v_5 > 0.004 && row.acc > 0.0015 && row.v_z > 1.3 && row.vol_z20 > 1.5
      );
      weightedCandidates.sort((a, b) => (b.momentum || 0) - (a.momentum || 0));
      const weightedPicks = weightedCandidates.slice(0, maxPicks);
      const weightedWeights = allocateWeights(
        weightedPicks.map((row) => row.momentum || 0)
      );
      const weightedSignals = [];
      let weightedReturnSum = 0;
      let weightedHoldings = 0;
      let weightedWeightSum = 0;
      weightedPicks.forEach((pick, idx) => {
        const weight = Number(weightedWeights[idx].toFixed(6));
        const ret1 = ret1ByStock.get(pick.stock_id) ?? null;
        if (ret1 !== null && ret1 !== undefined) {
          weightedReturnSum += ret1;
          weightedHoldings += 1;
          weightedWeightSum += weight;
        }
        weightedSignals.push({
          strategy_id: weightedStrategyId,
          risk_level: "core",
          week_end: tradeDate,
          stock_id: pick.stock_id,
          target_weight: weight,
          score: Number((pick.momentum || 0).toFixed(6)),
          reason: {
            v_5: pick.v_5,
            v_20: pick.v_20,
            acc: pick.acc,
            v_z: pick.v_z,
            vol_z20: pick.vol_z20,
            ps: pick.ps,
            momentum: pick.momentum,
          },
        });
      });

      const weightedReturnValue = weightedHoldings
        ? Number((weightedReturnSum / weightedHoldings).toFixed(6))
        : null;
      latestDayReturns.set(weightedStrategyId, weightedReturnValue);

      const history = rollingMap.get(weightedStrategyId) || [];
      if (weightedReturnValue !== null && weightedReturnValue !== undefined) {
        history.unshift(weightedReturnValue);
      }
      const nextHistory = history.slice(0, 10);
      rollingMap.set(weightedStrategyId, nextHistory);
      const avgRolling = nextHistory.length
        ? Number(
            (nextHistory.reduce((sum, v) => sum + v, 0) / nextHistory.length).toFixed(6)
          )
        : null;

      dailyRows.push({
        strategy_id: weightedStrategyId,
        trade_date: tradeDate,
        daily_return: weightedReturnValue,
        weighted_return: weightedReturnValue,
        cumulative_return: avgRolling,
        holdings_count: weightedHoldings,
        weight_sum: Number(weightedWeightSum.toFixed(6)),
        source: "backtest",
      });

      dailySignalsByStrategy.set(weightedStrategyId, weightedSignals);
    }

    if (!dryRun && dailyRows.length) {
      const { error: dailyError } = await supabase
        .from("strategy_daily_performance")
        .upsert(dailyRows, { onConflict: "strategy_id,trade_date" });
      if (dailyError) throw new Error(`strategy_daily_performance upsert failed: ${dailyError.message}`);
    }

    if (i === tradeDates.length - 1) {
      latestSignalsPayload = [];
      latestRunsPayload = [];
      STRATEGY_CAPITALS.forEach((capital) => {
        STRATEGY_RISKS.forEach((risk) => {
          const strategyId = `${capital.id}_${risk.id}`;
          if (!shouldInclude(strategyId)) return;
          const signals = dailySignalsByStrategy.get(strategyId) || [];
          latestSignalsPayload.push(...signals);
          latestRunsPayload.push({
            strategy_id: strategyId,
            risk_level: risk.riskLevel,
            week_end: tradeDate,
            universe_count: liquidityTop,
            selected_count: signals.length,
            gross_exposure: 1.0,
            risk_state: "normal",
            metrics: {
              label: STRATEGY_LABELS[strategyId] || strategyId,
              drawdown: null,
              volatility: null,
              sharpe: null,
              annualized_return: null,
              win_rate: null,
              prev_day_return: prevDayReturns.get(strategyId) ?? null,
              today_return: latestDayReturns.get(strategyId) ?? null,
              cumulative_return: (rollingMap.get(strategyId) || [])[0] ?? null,
            },
          });
        });
      });
      const strengthStrategyId = "tw_strength_core_v1";
      if (shouldInclude(strengthStrategyId)) {
        const signals = dailySignalsByStrategy.get(strengthStrategyId) || [];
        latestSignalsPayload.push(...signals);
        latestRunsPayload.push({
          strategy_id: strengthStrategyId,
          risk_level: "core",
          week_end: tradeDate,
          universe_count: liquidityTop,
          selected_count: signals.length,
          gross_exposure: 1.0,
          risk_state: "normal",
          metrics: {
            label: STRATEGY_LABELS[strengthStrategyId] || strengthStrategyId,
            drawdown: null,
            volatility: null,
            sharpe: null,
            annualized_return: null,
            win_rate: null,
            prev_day_return: prevDayReturns.get(strengthStrategyId) ?? null,
            today_return: latestDayReturns.get(strengthStrategyId) ?? null,
            cumulative_return: (rollingMap.get(strengthStrategyId) || [])[0] ?? null,
          },
        });
      }
      const accelStrategyId = "tw_acceleration_monitor_v1";
      if (shouldInclude(accelStrategyId)) {
        const signals = dailySignalsByStrategy.get(accelStrategyId) || [];
        latestSignalsPayload.push(...signals);
        latestRunsPayload.push({
          strategy_id: accelStrategyId,
          risk_level: "core",
          week_end: tradeDate,
          universe_count: liquidityTop,
          selected_count: signals.length,
          gross_exposure: 1.0,
          risk_state: "normal",
          metrics: {
            label: STRATEGY_LABELS[accelStrategyId] || accelStrategyId,
            drawdown: null,
            volatility: null,
            sharpe: null,
            annualized_return: null,
            win_rate: null,
            prev_day_return: prevDayReturns.get(accelStrategyId) ?? null,
            today_return: latestDayReturns.get(accelStrategyId) ?? null,
            cumulative_return: (rollingMap.get(accelStrategyId) || [])[0] ?? null,
          },
        });
      }
      const weightedStrategyId = "tw_acceleration_weighted_v1";
      if (shouldInclude(weightedStrategyId)) {
        const signals = dailySignalsByStrategy.get(weightedStrategyId) || [];
        latestSignalsPayload.push(...signals);
        latestRunsPayload.push({
          strategy_id: weightedStrategyId,
          risk_level: "core",
          week_end: tradeDate,
          universe_count: liquidityTop,
          selected_count: signals.length,
          gross_exposure: 1.0,
          risk_state: "normal",
          metrics: {
            label: STRATEGY_LABELS[weightedStrategyId] || weightedStrategyId,
            drawdown: null,
            volatility: null,
            sharpe: null,
            annualized_return: null,
            win_rate: null,
            prev_day_return: prevDayReturns.get(weightedStrategyId) ?? null,
            today_return: latestDayReturns.get(weightedStrategyId) ?? null,
            cumulative_return: (rollingMap.get(weightedStrategyId) || [])[0] ?? null,
          },
        });
      }
    }
  }

  if (!dryRun && latestRunsPayload.length) {
    const { error: runError } = await supabase
      .from("strategy_runs")
      .upsert(latestRunsPayload, { onConflict: "strategy_id,week_end" });
    if (runError) throw new Error(`strategy_runs upsert failed: ${runError.message}`);

    if (cleanOld) {
      const latestDate = latestRunsPayload[0].week_end;
      const strategyIds = latestRunsPayload.map((row) => row.strategy_id);
      const { error: deleteError } = await supabase
        .from("strategy_runs")
        .delete()
        .lt("week_end", latestDate)
        .in("strategy_id", strategyIds);
      if (deleteError) throw new Error(`strategy_runs cleanup failed: ${deleteError.message}`);
    }
  }

  if (!dryRun && latestSignalsPayload.length) {
    const { error: signalError } = await supabase
      .from("strategy_signals")
      .upsert(latestSignalsPayload, { onConflict: "strategy_id,week_end,stock_id" });
    if (signalError) throw new Error(`strategy_signals upsert failed: ${signalError.message}`);
  }

  if (!dryRun && latestSignalsPayload.length) {
    const latestDate = latestSignalsPayload[0].week_end;
    const { data: prevSignals, error: prevError } = await supabase
      .from("strategy_signals")
      .select("strategy_id,stock_id,target_weight")
      .lt("week_end", latestDate)
      .order("week_end", { ascending: false })
      .limit(30);
    if (!prevError && prevSignals && prevSignals.length) {
      const prevWeek = prevSignals[0].week_end;
      const { data: prevDayRows, error: prevDayError } = await supabase
        .from("strategy_signals")
        .select("strategy_id,stock_id,target_weight")
        .eq("week_end", prevWeek);
      if (!prevDayError) {
        const prevByStrategy = new Map();
        (prevDayRows || []).forEach((row) => {
          if (!prevByStrategy.has(row.strategy_id)) {
            prevByStrategy.set(row.strategy_id, []);
          }
          prevByStrategy.get(row.strategy_id).push(row);
        });
        const nextByStrategy = new Map();
        latestSignalsPayload.forEach((row) => {
          if (!nextByStrategy.has(row.strategy_id)) {
            nextByStrategy.set(row.strategy_id, []);
          }
          nextByStrategy.get(row.strategy_id).push(row);
        });
        const rebalances = [];
        nextByStrategy.forEach((nextRows, strategyId) => {
          const prevRows = prevByStrategy.get(strategyId) || [];
          const turnover = computeTurnover(prevRows, nextRows);
          const delta = extractDelta(prevRows, nextRows);
          rebalances.push({
            strategy_id: strategyId,
            rebalance_date: latestDate,
            prev_date: prevWeek,
            turnover,
            added: delta.added,
            removed: delta.removed,
          });
        });
        if (rebalances.length) {
          await supabase.from("strategy_rebalances").upsert(rebalances, {
            onConflict: "strategy_id,rebalance_date",
          });
        }
      }
    }
  }

  if (dryRun) {
    console.log("Dry run complete.", {
      startDate,
      endDate,
      days: tradeDates.length,
      strategies: activeStrategyIds,
    });
  } else {
    console.log("Backtest complete.", {
      startDate,
      endDate,
      days: tradeDates.length,
      strategies: activeStrategyIds,
    });
  }

  return {
    status: "ok",
    startDate,
    endDate,
    days: tradeDates.length,
    strategyIds: activeStrategyIds,
    dryRun,
  };
};

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  runBacktest().catch((error) => {
    console.error("Backtest failed:", error);
    process.exit(1);
  });
}
