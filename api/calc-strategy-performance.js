import { createClient } from "@supabase/supabase-js";

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
    const weekEnd = params.week_end || null;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let runsQuery = supabase.from("strategy_runs").select("run_id,strategy_id,week_end,metrics");
    if (weekEnd) {
      runsQuery = runsQuery.eq("week_end", weekEnd);
    } else {
      runsQuery = runsQuery.order("week_end", { ascending: false }).limit(30);
    }
    const { data: runs, error: runError } = await runsQuery;
    if (runError) throw new Error(`strategy_runs query failed: ${runError.message}`);

    if (!runs || !runs.length) {
      res.status(200).json({ status: "ok", updated: 0 });
      return;
    }

    const latestWeek = runs[0].week_end;
    const { data: signals, error: sigError } = await supabase
      .from("strategy_signals")
      .select("strategy_id,stock_id,target_weight")
      .eq("week_end", latestWeek);
    if (sigError) throw new Error(`strategy_signals query failed: ${sigError.message}`);

    const stockIds = [...new Set((signals || []).map((s) => s.stock_id))];
    const priceMap = new Map();

    const chunkSize = 50;
    for (let i = 0; i < stockIds.length; i += chunkSize) {
      const chunk = stockIds.slice(i, i + chunkSize);
      const { data: prices, error: priceError } = await supabase
        .from("stock_prices")
        .select("stock_id,trade_date,open,close")
        .in("stock_id", chunk)
        .order("trade_date", { ascending: false });
      if (priceError) throw new Error(`stock_prices query failed: ${priceError.message}`);
      (prices || []).forEach((row) => {
        if (!priceMap.has(row.stock_id)) priceMap.set(row.stock_id, []);
        priceMap.get(row.stock_id).push(row);
      });
    }

    const signalsByStrategy = new Map();
    (signals || []).forEach((signal) => {
      if (!signalsByStrategy.has(signal.strategy_id)) {
        signalsByStrategy.set(signal.strategy_id, []);
      }
      signalsByStrategy.get(signal.strategy_id).push(signal);
    });

    const updates = [];
    runs.forEach((run) => {
      const sigs = signalsByStrategy.get(run.strategy_id) || [];
      if (!sigs.length) return;
      let today = 0;
      let prevDay = 0;
      let cumulative = 0;
      let todayCount = 0;
      sigs.forEach((sig) => {
        const prices = priceMap.get(sig.stock_id) || [];
        if (!prices.length) return;
        const latest = prices[0];
        const prev = prices[1];
        const weekStart = prices.find((p) => p.trade_date >= run.week_end) || prices[prices.length - 1];
        if (latest?.open && latest?.close) {
          today += (sig.target_weight || 0) * ((latest.close - latest.open) / latest.open);
          todayCount += 1;
        }
        if (prev?.open && prev?.close) {
          prevDay += (sig.target_weight || 0) * ((prev.close - prev.open) / prev.open);
        }
        if (weekStart?.open && latest?.close) {
          cumulative += (sig.target_weight || 0) * ((latest.close - weekStart.open) / weekStart.open);
        }
      });
      updates.push({
        strategy_id: run.strategy_id,
        week_end: run.week_end,
        metrics: {
          ...(run.metrics || {}),
          prev_day_return: Number(prevDay.toFixed(6)),
          today_return: todayCount ? Number(today.toFixed(6)) : null,
          cumulative_return: Number(cumulative.toFixed(6)),
        },
      });
    });

    if (!updates.length) {
      res.status(200).json({ status: "ok", updated: 0 });
      return;
    }

    for (const row of updates) {
      const { error: updateError } = await supabase
        .from("strategy_runs")
        .update({ metrics: row.metrics })
        .eq("strategy_id", row.strategy_id)
        .eq("week_end", row.week_end);
      if (updateError) throw new Error(`strategy_runs update failed: ${updateError.message}`);
    }

    // update rebalance metrics snapshot (if exists)
    const rebalanceUpdates = updates
      .map((row) => ({
        strategy_id: row.strategy_id,
        rebalance_date: row.week_end,
        performance: row.metrics,
      }))
      .filter((row) => row.strategy_id);
    if (rebalanceUpdates.length) {
      await supabase
        .from("strategy_rebalances")
        .upsert(rebalanceUpdates, { onConflict: "strategy_id,rebalance_date" });
    }

    res.status(200).json({ status: "ok", updated: updates.length });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
