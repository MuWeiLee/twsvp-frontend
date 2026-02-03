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
      runsQuery = runsQuery.order("week_end", { ascending: false }).limit(60);
    }
    const { data: rawRuns, error: runError } = await runsQuery;
    if (runError) throw new Error(`strategy_runs query failed: ${runError.message}`);

    if (!rawRuns || !rawRuns.length) {
      res.status(200).json({ status: "ok", updated: 0 });
      return;
    }

    const runs = [];
    const runByStrategy = new Map();
    rawRuns.forEach((run) => {
      const existing = runByStrategy.get(run.strategy_id);
      if (!existing || run.week_end > existing.week_end) {
        runByStrategy.set(run.strategy_id, run);
      }
    });
    runByStrategy.forEach((run) => runs.push(run));
    runs.sort((a, b) => (a.week_end < b.week_end ? 1 : -1));

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
      let todaySum = 0;
      let prevDaySum = 0;
      let todayCount = 0;
      let prevDayCount = 0;
      let todayWeightSum = 0;
      let latestTradeDate = null;
      let prevTradeDate = null;
      sigs.forEach((sig) => {
        const prices = priceMap.get(sig.stock_id) || [];
        if (!prices.length) return;
        const latest = prices[0];
        const prev = prices[1];
        const prevPrev = prices[2];
        if (latest?.close && prev?.close) {
          const ret = (latest.close - prev.close) / prev.close;
          todaySum += ret;
          todayCount += 1;
          todayWeightSum += sig.target_weight || 0;
          if (!latestTradeDate || latest.trade_date > latestTradeDate) {
            latestTradeDate = latest.trade_date;
          }
          if (!prevTradeDate || prev.trade_date > prevTradeDate) {
            prevTradeDate = prev.trade_date;
          }
        }
        if (prev?.close && prevPrev?.close) {
          prevDaySum += (prev.close - prevPrev.close) / prevPrev.close;
          prevDayCount += 1;
        }
      });
      const today = todayCount ? Number((todaySum / todayCount).toFixed(6)) : null;
      const prevDay = prevDayCount ? Number((prevDaySum / prevDayCount).toFixed(6)) : null;
      updates.push({
        strategy_id: run.strategy_id,
        week_end: run.week_end,
        metrics: {
          ...(run.metrics || {}),
          prev_day_return: prevDay,
          today_return: today,
          cumulative_return: null,
        },
        latestTradeDate,
        prevTradeDate,
        todayCount,
        todayWeightSum,
      });
    });

    if (!updates.length) {
      res.status(200).json({ status: "ok", updated: 0 });
      return;
    }

    const strategyIds = updates.map((row) => row.strategy_id);
    const { data: priorDaily, error: priorDailyError } = await supabase
      .from("strategy_daily_performance")
      .select("strategy_id,trade_date,daily_return,cumulative_return")
      .in("strategy_id", strategyIds)
      .order("trade_date", { ascending: false });
    if (priorDailyError) {
      throw new Error(`strategy_daily_performance query failed: ${priorDailyError.message}`);
    }

    const priorByStrategy = new Map();
    (priorDaily || []).forEach((row) => {
      if (!priorByStrategy.has(row.strategy_id)) {
        priorByStrategy.set(row.strategy_id, []);
      }
      priorByStrategy.get(row.strategy_id).push(row);
    });

    const dailyRows = updates
      .filter((row) => row.latestTradeDate)
      .map((row) => ({
        strategy_id: row.strategy_id,
        trade_date: row.latestTradeDate,
        daily_return: row.metrics.today_return,
        weighted_return: row.metrics.today_return,
        holdings_count: row.todayCount,
        weight_sum: Number(row.todayWeightSum.toFixed(6)),
        source: "cron",
        cumulative_return: null,
      }));
    const cumulativeByStrategy = new Map();
    dailyRows.forEach((row) => {
      const priorList = priorByStrategy.get(row.strategy_id) || [];
      const filtered = priorList
        .filter((item) => item.trade_date !== row.trade_date)
        .map((item) => item.daily_return)
        .filter((value) => value !== null && value !== undefined);
      const window = [];
      if (row.daily_return !== null && row.daily_return !== undefined) {
        window.push(row.daily_return);
      }
      window.push(...filtered.slice(0, 9));
      const avg =
        window.length > 0
          ? Number((window.reduce((sum, v) => sum + v, 0) / window.length).toFixed(6))
          : null;
      row.cumulative_return = avg;
      cumulativeByStrategy.set(row.strategy_id, avg);
    });

    for (const row of updates) {
      if (cumulativeByStrategy.has(row.strategy_id)) {
        row.metrics.cumulative_return = cumulativeByStrategy.get(row.strategy_id);
      }
      const { error: updateError } = await supabase
        .from("strategy_runs")
        .update({ metrics: row.metrics })
        .eq("strategy_id", row.strategy_id)
        .eq("week_end", row.week_end);
      if (updateError) throw new Error(`strategy_runs update failed: ${updateError.message}`);
    }
    if (dailyRows.length) {
      const { error: dailyError } = await supabase
        .from("strategy_daily_performance")
        .upsert(dailyRows, { onConflict: "strategy_id,trade_date" });
      if (dailyError) throw new Error(`strategy_daily_performance upsert failed: ${dailyError.message}`);
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
