import { createClient } from "@supabase/supabase-js";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const parseParams = (req) => {
  if (req.method !== "POST") return req.query || {};
  if (!req.body) return req.query || {};
  if (typeof req.body === "string") {
    try {
      return { ...(req.query || {}), ...JSON.parse(req.body) };
    } catch (error) {
      return req.query || {};
    }
  }
  return { ...(req.query || {}), ...(req.body || {}) };
};

const toDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return `${value}`.slice(0, 10);
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

const computeStockOnlyAccelerationMetrics = (rows) => {
  if (!rows.length) return null;
  const closes = rows.map((r) => r.close);
  const highs = rows.map((r) => r.high);
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
  const vShift = v5 / v5Sma20;

  const volSlice = volumes.slice(idx - 19, idx + 1);
  const volSma20 = mean(volSlice);
  if (!volSma20) return null;
  const volShift = volumes[idx] / volSma20;

  const highs20 = highs.slice(idx - 19, idx + 1);
  const maxHigh20 = highs20.length === 20 ? Math.max(...highs20) : null;
  const dd20 = maxHigh20 ? close / maxHigh20 - 1 : null;

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
  const accAbsSma20 = mean(accSeries.map((v) => Math.abs(v)));
  const momentumScore =
    0.4 * clip(vShift, 0, 3) +
    0.3 * clip(accAbsSma20 ? accSeries[accSeries.length - 1] / accAbsSma20 : 0, 0, 3) +
    0.15 * ps +
    0.15 * clip(Math.log(volShift), 0, 2);

  return {
    v_5: v5,
    v_20: v20,
    acc: v5 - v20,
    v_shift: vShift,
    vol_shift: volShift,
    dd_20: dd20,
    ps,
    momentum_score: momentumScore,
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
  tw_stock_only_acceleration_v1: "涨速监控",
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

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET } = process.env;
  if (CRON_SECRET) {
    const secret = req.headers["x-cron-secret"] || req.query?.secret;
    const userAgent = `${req.headers["user-agent"] || ""}`;
    const isVercelCron =
      req.headers["x-vercel-cron"] === "1" || userAgent.startsWith("vercel-cron/");
    if (!isVercelCron && secret !== CRON_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing required env vars" });
    return;
  }

  try {
    const params = parseParams(req);
    const lookback = Number(params.lookback || 20);
    const accelLookback = 30;
    const fetchLookback = Math.max(lookback, accelLookback);
    const liquidityTop = Number(params.liquidity_top || 500);
    const dryRun = `${params.dry_run || ""}` === "1";
    const maxPicks = Math.min(Number(params.max_picks || 5), 5);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let weekEnd = params.week_end ? toDateString(params.week_end) : null;
    const latestTradeDate = weekEnd
      ? weekEnd
      : toDateString(
          await (async () => {
            const { data, error } = await supabase
              .from("stock_prices")
              .select("trade_date")
              .order("trade_date", { ascending: false })
              .limit(1);
            if (error) throw new Error(`Supabase latest trade_date failed: ${error.message}`);
            return data?.[0]?.trade_date || null;
          })()
        );
    weekEnd = latestTradeDate || toDateString(new Date());

    const weekEndDate = new Date(weekEnd);
    const startDate = new Date(weekEndDate);
    startDate.setDate(startDate.getDate() - fetchLookback);

    const { data: stocks, error: stockError } = await supabase
      .from("stocks")
      .select("stock_id,name,is_active")
      .eq("is_active", true)
      .order("stock_id", { ascending: true });
    if (stockError) throw new Error(`Supabase stocks query failed: ${stockError.message}`);

    const filteredStocks = (stocks || []).filter((s) => s?.stock_id && !isEtf(s));
    const stockIds = filteredStocks.map((s) => s.stock_id);

    const chunkSize = 50;
    const priceMap = new Map();
    for (let i = 0; i < stockIds.length; i += chunkSize) {
      const chunk = stockIds.slice(i, i + chunkSize);
      const { data: prices, error } = await supabase
        .from("stock_prices")
        .select("stock_id,trade_date,close,volume,turnover,high,low")
        .in("stock_id", chunk)
        .gte("trade_date", toDateString(startDate))
        .lte("trade_date", weekEnd)
        .order("trade_date", { ascending: true });
      if (error) throw new Error(`Supabase stock_prices failed: ${error.message}`);
      (prices || []).forEach((row) => {
        if (!priceMap.has(row.stock_id)) priceMap.set(row.stock_id, []);
        priceMap.get(row.stock_id).push(row);
      });
    }

    let latestTradeDate = null;
    priceMap.forEach((rows) => {
      rows.forEach((row) => {
        if (row.trade_date && (!latestTradeDate || row.trade_date > latestTradeDate)) {
          latestTradeDate = row.trade_date;
        }
      });
    });

    const stats = [];
    filteredStocks.forEach((stock) => {
      const rows = priceMap.get(stock.stock_id) || [];
      const closes = rows.map((r) => r.close).filter((v) => v !== null && v !== undefined);
      if (closes.length < 2) return;
      const volumes = rows.map((r) => r.volume || 0);
      const turnovers = rows.map((r) =>
        r.turnover !== null && r.turnover !== undefined
          ? r.turnover
          : (r.close || 0) * (r.volume || 0)
      );
      const highs = rows.map((r) => r.high).filter((v) => v !== null && v !== undefined);
      const lows = rows.map((r) => r.low).filter((v) => v !== null && v !== undefined);
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

    const runsPayload = [];
    const signalsPayload = [];

    const buildStrategy = ({
      strategyId,
      profileId,
      riskLevel,
      priceMin = null,
      priceMax = null,
    }) => {
      const capitalUniverse = universe;
      capitalUniverse.forEach((item) => {
        item.profile_score = profileScore(profileId, item);
      });

      const bucketCandidates = capitalUniverse
        .filter((item) => inPriceBucket(item.last_close, priceMin, priceMax))
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
      picks.forEach((pick, idx) => {
        signalsPayload.push({
          strategy_id: strategyId,
          risk_level: riskLevel,
          week_end: weekEnd,
          stock_id: pick.stock_id,
          target_weight: Number(weights[idx].toFixed(6)),
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

      runsPayload.push({
        strategy_id: strategyId,
        risk_level: riskLevel,
        week_end: weekEnd,
        universe_count: capitalUniverse.length,
        selected_count: picks.length,
        gross_exposure: 1.0,
        risk_state: "normal",
        metrics: {
          label: STRATEGY_LABELS[strategyId] || strategyId,
          drawdown: null,
          volatility: null,
          sharpe: null,
          annualized_return: null,
          win_rate: null,
        },
      });
    };

    STRATEGY_CAPITALS.forEach((capital) => {
    STRATEGY_RISKS.forEach((risk) => {
        buildStrategy({
          strategyId: `${capital.id}_${risk.id}`,
          profileId: risk.id,
          riskLevel: risk.riskLevel,
          priceMin: capital.priceMin,
          priceMax: capital.priceMax,
        });
      });
    });

    const strengthStrategyId = "tw_strength_core_v1";
    const strengthRows = [];
    if (latestTradeDate) {
      universe.forEach((stock) => {
        const rows = (priceMap.get(stock.stock_id) || []).slice();
        rows.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
        const idx = rows.findIndex((row) => row.trade_date === latestTradeDate);
        if (idx < 0) return;
        const row = rows[idx];
        if (!row || !row.volume || row.volume <= 0) return;
        const close = row.close;
        const high = row.high;
        if (close === null || close === undefined || high === null || high === undefined) return;
        const closes = rows.map((r) => r.close);
        const highs = rows.map((r) => r.high);
        const volumes = rows.map((r) => r.volume || 0);
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
          stock_id: stock.stock_id,
          name: stock.name || stock.stock_id,
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
    }

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
        (row.score_RS * 0.5 + row.score_vol * 0.3 + row.score_dd * 0.2) * row.HH_Filter;
    });

    strengthEligible.sort((a, b) => (b.Total_Score || 0) - (a.Total_Score || 0));
    const strengthPicks = strengthEligible.slice(0, 5);
    const expScores = strengthPicks.map((row) => Math.exp(Math.max(0, row.Total_Score || 0) * 5));
    const expSum = expScores.reduce((sum, v) => sum + v, 0) || 1;
    strengthPicks.forEach((pick, idx) => {
      const weight = expScores[idx] / expSum;
      signalsPayload.push({
        strategy_id: strengthStrategyId,
        risk_level: "core",
        week_end: weekEnd,
        stock_id: pick.stock_id,
        target_weight: Number(weight.toFixed(6)),
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
    runsPayload.push({
      strategy_id: strengthStrategyId,
      risk_level: "core",
      week_end: weekEnd,
      universe_count: strengthEligible.length,
      selected_count: strengthPicks.length,
      gross_exposure: 1.0,
      risk_state: "normal",
      metrics: {
        label: STRATEGY_LABELS[strengthStrategyId] || strengthStrategyId,
        drawdown: null,
        volatility: null,
        sharpe: null,
        annualized_return: null,
        win_rate: null,
      },
    });

    const accelStrategyId = "tw_acceleration_monitor_v1";
    const accelRows = [];
    if (latestTradeDate) {
      universe.forEach((stock) => {
        const rows = (priceMap.get(stock.stock_id) || []).slice();
        rows.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
        const lastRow = rows[rows.length - 1];
        if (!lastRow || lastRow.trade_date !== latestTradeDate) return;
        const metrics = computeAccelerationMetrics(rows);
        if (!metrics) return;
        accelRows.push({
          stock_id: stock.stock_id,
          name: stock.name || stock.stock_id,
          close: lastRow.close,
          ...metrics,
        });
      });
    }

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
    accelPicks.forEach((pick, idx) => {
      signalsPayload.push({
        strategy_id: accelStrategyId,
        risk_level: "core",
        week_end: weekEnd,
        stock_id: pick.stock_id,
        target_weight: Number(accelWeights[idx].toFixed(6)),
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
    runsPayload.push({
      strategy_id: accelStrategyId,
      risk_level: "core",
      week_end: weekEnd,
      universe_count: accelRows.length,
      selected_count: accelPicks.length,
      gross_exposure: 1.0,
      risk_state: "normal",
      metrics: {
        label: STRATEGY_LABELS[accelStrategyId] || accelStrategyId,
        drawdown: null,
        volatility: null,
        sharpe: null,
        annualized_return: null,
        win_rate: null,
      },
    });

    const weightedStrategyId = "tw_acceleration_weighted_v1";
    const weightedRows = [];
    if (latestTradeDate) {
      universe.forEach((stock) => {
        const rows = (priceMap.get(stock.stock_id) || []).slice();
        rows.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
        const lastRow = rows[rows.length - 1];
        if (!lastRow || lastRow.trade_date !== latestTradeDate) return;
        const metrics = computeAccelerationWeightedMetrics(rows);
        if (!metrics) return;
        weightedRows.push({
          stock_id: stock.stock_id,
          name: stock.name || stock.stock_id,
          close: lastRow.close,
          ...metrics,
        });
      });
    }

    const weightedCandidates = weightedRows.filter(
      (row) => row.v_5 > 0.004 && row.acc > 0.0015 && row.v_z > 1.3 && row.vol_z20 > 1.5
    );
    weightedCandidates.sort((a, b) => (b.momentum || 0) - (a.momentum || 0));
    const weightedPicks = weightedCandidates.slice(0, maxPicks);
    const weightedWeights = allocateWeights(weightedPicks.map((row) => row.momentum || 0));
    weightedPicks.forEach((pick, idx) => {
      signalsPayload.push({
        strategy_id: weightedStrategyId,
        risk_level: "core",
        week_end: weekEnd,
        stock_id: pick.stock_id,
        target_weight: Number(weightedWeights[idx].toFixed(6)),
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
    runsPayload.push({
      strategy_id: weightedStrategyId,
      risk_level: "core",
      week_end: weekEnd,
      universe_count: weightedRows.length,
      selected_count: weightedPicks.length,
      gross_exposure: 1.0,
      risk_state: "normal",
      metrics: {
        label: STRATEGY_LABELS[weightedStrategyId] || weightedStrategyId,
        drawdown: null,
        volatility: null,
        sharpe: null,
        annualized_return: null,
        win_rate: null,
      },
    });

    const stockOnlyStrategyId = "tw_stock_only_acceleration_v1";
    const stockOnlyRows = [];
    if (latestTradeDate) {
      universe.forEach((stock) => {
        const rows = (priceMap.get(stock.stock_id) || []).slice();
        rows.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
        const lastRow = rows[rows.length - 1];
        if (!lastRow || lastRow.trade_date !== latestTradeDate) return;
        const metrics = computeStockOnlyAccelerationMetrics(rows);
        if (!metrics) return;
        stockOnlyRows.push({
          stock_id: stock.stock_id,
          name: stock.name || stock.stock_id,
          close: lastRow.close,
          ...metrics,
        });
      });
    }

    const stockOnlyCandidates = stockOnlyRows.filter(
      (row) =>
        row.v_5 > 0.0035 &&
        row.acc > 0 &&
        row.v_shift > 1.25 &&
        row.vol_shift > 1.3 &&
        row.dd_20 !== null &&
        row.dd_20 > -0.1
    );
    stockOnlyCandidates.sort((a, b) => (b.momentum_score || 0) - (a.momentum_score || 0));
    const stockOnlyPicks = stockOnlyCandidates.slice(0, maxPicks);
    const stockOnlyWeights = allocateWeights(
      stockOnlyPicks.map((row) => row.momentum_score || 0)
    );
    stockOnlyPicks.forEach((pick, idx) => {
      signalsPayload.push({
        strategy_id: stockOnlyStrategyId,
        risk_level: "core",
        week_end: weekEnd,
        stock_id: pick.stock_id,
        target_weight: Number(stockOnlyWeights[idx].toFixed(6)),
        score: Number((pick.momentum_score || 0).toFixed(6)),
        reason: {
          v_5: pick.v_5,
          v_20: pick.v_20,
          acc: pick.acc,
          v_shift: pick.v_shift,
          vol_shift: pick.vol_shift,
          dd_20: pick.dd_20,
          ps: pick.ps,
          momentum_score: pick.momentum_score,
        },
      });
    });
    runsPayload.push({
      strategy_id: stockOnlyStrategyId,
      risk_level: "core",
      week_end: weekEnd,
      universe_count: stockOnlyRows.length,
      selected_count: stockOnlyPicks.length,
      gross_exposure: 1.0,
      risk_state: "normal",
      metrics: {
        label: STRATEGY_LABELS[stockOnlyStrategyId] || stockOnlyStrategyId,
        drawdown: null,
        volatility: null,
        sharpe: null,
        annualized_return: null,
        win_rate: null,
      },
    });

    if (dryRun) {
      res.status(200).json({ runs: runsPayload.slice(0, 2), signals: signalsPayload.slice(0, 5) });
      return;
    }

    const { error: runError } = await supabase
      .from("strategy_runs")
      .upsert(runsPayload, { onConflict: "strategy_id,week_end" });
    if (runError) throw new Error(`strategy_runs upsert failed: ${runError.message}`);

    const { error: signalError } = await supabase
      .from("strategy_signals")
      .upsert(signalsPayload, { onConflict: "strategy_id,week_end,stock_id" });
    if (signalError) throw new Error(`strategy_signals upsert failed: ${signalError.message}`);

    // record rebalance results
    const { data: prevRuns } = await supabase
      .from("strategy_runs")
      .select("strategy_id,week_end")
      .lt("week_end", weekEnd)
      .order("week_end", { ascending: false })
      .limit(30);
    const prevWeek = prevRuns && prevRuns.length ? prevRuns[0].week_end : null;
    if (prevWeek) {
      const { data: prevSignals, error: prevError } = await supabase
        .from("strategy_signals")
        .select("strategy_id,stock_id,target_weight")
        .eq("week_end", prevWeek);
      if (!prevError) {
        const prevByStrategy = new Map();
        (prevSignals || []).forEach((row) => {
          if (!prevByStrategy.has(row.strategy_id)) {
            prevByStrategy.set(row.strategy_id, []);
          }
          prevByStrategy.get(row.strategy_id).push(row);
        });
        const nextByStrategy = new Map();
        signalsPayload.forEach((row) => {
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
            rebalance_date: weekEnd,
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

    res.status(200).json({ status: "ok", runs: runsPayload.length, signals: signalsPayload.length });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
