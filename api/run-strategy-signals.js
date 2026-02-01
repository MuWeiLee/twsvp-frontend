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

const zscore = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sd = stddev(values);
  if (!sd) return 0;
  return (values[values.length - 1] - mean) / sd;
};

const STRATEGY_CAPITALS = [
  { id: "fixed_5w", name: "固定金额 5万", liquidityTop: 800 },
  { id: "fixed_20w", name: "固定金额 20万", liquidityTop: 500 },
  { id: "fixed_50w", name: "固定金额 50万", liquidityTop: 300 },
  { id: "dca_2k", name: "定投 每周 2000" },
  { id: "dca_5k", name: "定投 每周 5000" },
  { id: "dca_10k", name: "定投 每周 10000" },
];

const STRATEGY_RISKS = [
  { id: "high_high", riskLevel: "high", momWeight: 0.7, volWeight: 0.4, liqWeight: 0.2 },
  { id: "high_mid", riskLevel: "mid", momWeight: 0.7, volWeight: 0.2, liqWeight: 0.2 },
  { id: "mid_mid", riskLevel: "mid", momWeight: 0.5, volWeight: 0.0, liqWeight: 0.3 },
  { id: "mid_low", riskLevel: "low", momWeight: 0.3, volWeight: -0.3, liqWeight: 0.5 },
  { id: "low_low", riskLevel: "low", momWeight: 0.1, volWeight: -0.6, liqWeight: 0.6 },
];

const allocateWeights = (scores) => {
  const positives = scores.map((s) => Math.max(0, s));
  const total = positives.reduce((sum, v) => sum + v, 0);
  if (!total) return scores.map(() => 1 / scores.length);
  return positives.map((s) => s / total);
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
        .select("stock_id,trade_date,close,volume,turnover")
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
      const returns = closes.slice(1).map((v, idx) => percentChange(closes[idx], v));
      const momentum = percentChange(closes[0], closes[closes.length - 1]);
      const volatility = stddev(returns);
      const volumeZ = zscore(volumes);
      const turnoverZ = zscore(turnovers);
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const avgTurnover = turnovers.reduce((sum, v) => sum + v, 0) / turnovers.length;
      stats.push({
        stock_id: stock.stock_id,
        name: stock.name || stock.stock_id,
        momentum,
        volatility,
        volume_z: volumeZ,
        turnover_z: turnoverZ,
        avg_volume: avgVolume,
        avg_turnover: avgTurnover,
        score: momentum * 0.7 + volumeZ * 0.3,
      });
    });

    stats.sort((a, b) => (b.avg_turnover || 0) - (a.avg_turnover || 0));
    const universe = stats.slice(0, liquidityTop);

    const runsPayload = [];
    const signalsPayload = [];

    STRATEGY_CAPITALS.forEach((capital) => {
      const capitalUniverse = capital.liquidityTop
        ? universe.slice(0, capital.liquidityTop)
        : universe;
      STRATEGY_RISKS.forEach((risk) => {
        const strategyId = `${capital.id}_${risk.id}`;
        const ranked = capitalUniverse
          .map((item) => ({
            item,
            adjusted:
              item.momentum * risk.momWeight +
              item.volatility * risk.volWeight +
              item.turnover_z * risk.liqWeight,
          }))
          .sort((a, b) => b.adjusted - a.adjusted)
          .slice(0, maxPicks)
          .map((entry) => entry.item);

        const weights = allocateWeights(ranked.map((r) => r.score));
        ranked.forEach((pick, idx) => {
          signalsPayload.push({
            strategy_id: strategyId,
            risk_level: risk.riskLevel,
            week_end: weekEnd,
            stock_id: pick.stock_id,
            target_weight: Number(weights[idx].toFixed(6)),
            score: Number(pick.score.toFixed(6)),
            reason: {
              momentum: pick.momentum,
              volatility: pick.volatility,
              volume_z: pick.volume_z,
              turnover_z: pick.turnover_z,
            },
          });
        });

        runsPayload.push({
          strategy_id: strategyId,
          risk_level: risk.riskLevel,
          week_end: weekEnd,
          universe_count: capitalUniverse.length,
          selected_count: ranked.length,
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

    res.status(200).json({ status: "ok", runs: runsPayload.length, signals: signalsPayload.length });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
