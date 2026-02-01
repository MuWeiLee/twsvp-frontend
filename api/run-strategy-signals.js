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
    const liquidityTop = Number(params.liquidity_top || 500);
    const dryRun = `${params.dry_run || ""}` === "1";
    const maxPicks = Number(params.max_picks || 5);

    const weekEnd = params.week_end
      ? toDateString(params.week_end)
      : toDateString(new Date());

    const weekEndDate = new Date(weekEnd);
    const startDate = new Date(weekEndDate);
    startDate.setDate(startDate.getDate() - lookback);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

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

    STRATEGY_CAPITALS.forEach((capital) => {
      const capitalUniverse = universe;
      STRATEGY_RISKS.forEach((risk) => {
        const strategyId = `${capital.id}_${risk.id}`;
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
        picks.forEach((pick, idx) => {
          signalsPayload.push({
            strategy_id: strategyId,
            risk_level: risk.riskLevel,
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
          risk_level: risk.riskLevel,
          week_end: weekEnd,
          universe_count: capitalUniverse.length,
          selected_count: picks.length,
          gross_exposure: 1.0,
          risk_state: "normal",
          metrics: {
            drawdown: null,
            volatility: null,
            sharpe: null,
            annualized_return: null,
            win_rate: null,
          },
        });
      });
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
