import { runBacktest } from "../scripts/quant/backtest_strategies.js";

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

const normalizeStrategyIds = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { CRON_SECRET } = process.env;
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

  try {
    const params = parseParams(req);
    const strategyIds = normalizeStrategyIds(params.strategy_ids);
    const startDate = params.start_date || null;
    const lookback = params.lookback ? Number(params.lookback) : undefined;
    const liquidityTop = params.liquidity_top ? Number(params.liquidity_top) : undefined;
    const maxPicks = params.max_picks ? Number(params.max_picks) : undefined;
    const dryRun = `${params.dry_run || ""}` === "1";
    const cleanOld = `${params.clean_old || ""}` !== "0";

    const result = await runBacktest({
      strategyIds,
      startDate,
      lookback,
      liquidityTop,
      maxPicks,
      dryRun,
      cleanOld,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || "Backtest failed" });
  }
}
