import { createClient } from "@supabase/supabase-js";

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

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

const chunkArray = (rows, size = 500) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const clampInt = (value, fallback, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const shiftDate = (dateStr, days) => {
  const base = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return dateStr;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

const mean = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const stdDev = (values, m) => {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
};

const parseStrategyParams = (params) => {
  const raw = params && typeof params === "object" && !Array.isArray(params) ? params : {};
  const topN = clampInt(raw.top_n, 5, 1, 30);
  const holdDays = clampInt(raw.hold_days, 5, 1, 30);
  const shortWin = clampInt(raw.momentum_window_short, 3, 1, 30);
  const longWin = clampInt(raw.momentum_window_long, 10, shortWin + 1, 90);
  const volumeMa = clampInt(raw.volume_ma, 10, 2, 60);
  return {
    topN,
    holdDays,
    shortWin,
    longWin,
    volumeMa,
  };
};

const isVercelCronRequest = (req) => {
  const userAgent = `${req.headers["user-agent"] || ""}`;
  return req.headers["x-vercel-cron"] === "1" || userAgent.startsWith("vercel-cron/");
};

const withTaipeiTimestamp = () => new Date(Date.now() + TAIPEI_OFFSET_MS).toISOString();

const fetchQueuedRuns = async (supabase, runId, maxRuns) => {
  if (runId) {
    const { data, error } = await supabase
      .from("quant_runs")
      .select("run_id,strategy_id,status,start_date,end_date,summary,error_message,created_at")
      .eq("run_id", runId)
      .limit(1);
    if (error) throw new Error(`quant_runs read failed: ${error.message}`);
    return (data || []).filter((row) => row.status === "queued");
  }

  const { data, error } = await supabase
    .from("quant_runs")
    .select("run_id,strategy_id,status,start_date,end_date,summary,error_message,created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(maxRuns);
  if (error) throw new Error(`quant_runs queue read failed: ${error.message}`);
  return data || [];
};

const claimRun = async (supabase, run) => {
  const now = withTaipeiTimestamp();
  const { data, error } = await supabase
    .from("quant_runs")
    .update({ status: "running", error_message: null, updated_at: now })
    .eq("run_id", run.run_id)
    .eq("status", "queued")
    .select("run_id,strategy_id,start_date,end_date,status")
    .single();
  if (error) return null;
  return data;
};

const buildPriceMap = (rows) => {
  const byStock = new Map();
  for (const row of rows) {
    if (!row.stock_id || !row.trade_date) continue;
    if (!byStock.has(row.stock_id)) {
      byStock.set(row.stock_id, new Map());
    }
    byStock.get(row.stock_id).set(row.trade_date, {
      close: Number(row.close),
      volume: Number(row.volume),
    });
  }
  return byStock;
};

const fetchAllStockPrices = async (supabase, minTradeDate, maxTradeDate, pageSize = 1000) => {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("stock_prices")
      .select("stock_id,trade_date,close,volume")
      .gte("trade_date", minTradeDate)
      .lte("trade_date", maxTradeDate)
      .order("trade_date", { ascending: true })
      .order("stock_id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`stock_prices read failed: ${error.message}`);
    }

    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
};

const collectDateRange = async (supabase, startDate, endDate, backBuffer, holdDays) => {
  const minDate = shiftDate(startDate, -Math.max(45, backBuffer * 6));
  const maxDate = shiftDate(endDate, Math.max(30, holdDays * 6));
  const { data, error } = await supabase
    .from("trading_calendar")
    .select("trade_date")
    .gte("trade_date", minDate)
    .lte("trade_date", maxDate)
    .order("trade_date", { ascending: true });
  if (error) {
    throw new Error(`trading_calendar read failed: ${error.message}`);
  }
  const dates = (data || []).map((row) => row.trade_date).filter(Boolean);
  if (!dates.length) {
    throw new Error("trading_calendar empty in target range");
  }
  const dateIndex = new Map(dates.map((date, idx) => [date, idx]));
  return { dates, dateIndex };
};

const computeRun = async (supabase, run, strategyParams) => {
  const { topN, holdDays, shortWin, longWin, volumeMa } = strategyParams;
  const requiredBack = Math.max(shortWin, longWin, volumeMa - 1);

  const { dates, dateIndex } = await collectDateRange(
    supabase,
    run.start_date,
    run.end_date,
    requiredBack,
    holdDays
  );

  const targetDates = dates.filter((date) => date >= run.start_date && date <= run.end_date);
  if (!targetDates.length) {
    throw new Error("run date range has no trading dates");
  }

  const firstTarget = targetDates[0];
  const lastTarget = targetDates[targetDates.length - 1];
  const firstIdx = dateIndex.get(firstTarget);
  const lastIdx = dateIndex.get(lastTarget);
  if (firstIdx === undefined || lastIdx === undefined) {
    throw new Error("target date index missing");
  }
  const minIdx = Math.max(0, firstIdx - requiredBack);
  const maxIdx = Math.min(dates.length - 1, lastIdx + holdDays);
  const minTradeDate = dates[minIdx];
  const maxTradeDate = dates[maxIdx];

  const prices = await fetchAllStockPrices(supabase, minTradeDate, maxTradeDate);

  const stockMap = buildPriceMap(prices || []);
  const perDayCandidates = new Map();

  for (const [stockId, series] of stockMap.entries()) {
    for (const tradeDate of targetDates) {
      const idx = dateIndex.get(tradeDate);
      if (idx === undefined) continue;
      if (idx - shortWin < 0 || idx - longWin < 0 || idx + holdDays >= dates.length) continue;

      const cur = series.get(tradeDate);
      const shortBase = series.get(dates[idx - shortWin]);
      const longBase = series.get(dates[idx - longWin]);
      const future = series.get(dates[idx + holdDays]);
      if (!cur || !shortBase || !longBase || !future) continue;
      if (!Number.isFinite(cur.close) || cur.close <= 0) continue;
      if (!Number.isFinite(shortBase.close) || shortBase.close <= 0) continue;
      if (!Number.isFinite(longBase.close) || longBase.close <= 0) continue;
      if (!Number.isFinite(future.close) || future.close <= 0) continue;

      const volValues = [];
      let volumeValid = true;
      for (let j = idx - (volumeMa - 1); j <= idx; j += 1) {
        const point = series.get(dates[j]);
        if (!point || !Number.isFinite(point.volume) || point.volume <= 0) {
          volumeValid = false;
          break;
        }
        volValues.push(point.volume);
      }
      if (!volumeValid) continue;

      const shortReturn = cur.close / shortBase.close - 1;
      const longReturn = cur.close / longBase.close - 1;
      const momentumAccel = shortReturn - longReturn;
      const avgVolume = mean(volValues);
      if (!Number.isFinite(avgVolume) || avgVolume <= 0) continue;
      const volumeRatio = cur.volume / avgVolume;
      const forwardReturn = future.close / cur.close - 1;
      if (!Number.isFinite(momentumAccel) || !Number.isFinite(volumeRatio)) continue;
      if (!Number.isFinite(forwardReturn)) continue;

      if (!perDayCandidates.has(tradeDate)) {
        perDayCandidates.set(tradeDate, []);
      }
      perDayCandidates.get(tradeDate).push({
        stockId,
        momentumAccel,
        volumeRatio,
        forwardReturn,
      });
    }
  }

  const pickRows = [];
  const dailyRows = [];
  let cumulative = 1;

  for (const tradeDate of targetDates) {
    const candidates = perDayCandidates.get(tradeDate) || [];
    if (!candidates.length) continue;

    const maValues = candidates.map((c) => c.momentumAccel).filter(Number.isFinite);
    const vrValues = candidates.map((c) => c.volumeRatio).filter(Number.isFinite);
    const maMean = mean(maValues);
    const vrMean = mean(vrValues);
    const maStd = stdDev(maValues, maMean);
    const vrStd = stdDev(vrValues, vrMean);

    const scored = candidates
      .map((item) => {
        const maZ = maStd > 0 ? (item.momentumAccel - maMean) / maStd : 0;
        const vrZ = vrStd > 0 ? (item.volumeRatio - vrMean) / vrStd : 0;
        const score = 0.6 * maZ + 0.4 * vrZ;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    if (!scored.length) continue;

    const dailyReturn = mean(scored.map((s) => s.forwardReturn));
    cumulative *= 1 + dailyReturn;

    scored.forEach((item, index) => {
      pickRows.push({
        run_id: run.run_id,
        trade_date: tradeDate,
        stock_id: item.stockId,
        pick_rank: index + 1,
        score: Number(item.score.toFixed(6)),
        return_pct: Number(item.forwardReturn.toFixed(6)),
      });
    });

    dailyRows.push({
      run_id: run.run_id,
      trade_date: tradeDate,
      daily_return: Number(dailyReturn.toFixed(6)),
      cumulative_return: Number((cumulative - 1).toFixed(6)),
    });
  }

  if (!dailyRows.length) {
    throw new Error("no computable rows in selected range");
  }

  const symbolSet = new Set(pickRows.map((row) => row.stock_id));
  const symbols = Array.from(symbolSet);
  if (symbols.length) {
    const { data: stocks } = await supabase
      .from("stocks")
      .select("stock_id,name")
      .in("stock_id", symbols);
    const nameMap = new Map((stocks || []).map((row) => [row.stock_id, row.name || null]));
    pickRows.forEach((row) => {
      row.stock_name = nameMap.get(row.stock_id) || null;
    });
  }

  const wins = dailyRows.filter((row) => Number(row.daily_return) > 0).length;
  const summary = {
    total_return: dailyRows[dailyRows.length - 1].cumulative_return,
    average_daily_return: Number(mean(dailyRows.map((r) => Number(r.daily_return))).toFixed(6)),
    win_rate: Number((wins / dailyRows.length).toFixed(6)),
    total_days: dailyRows.length,
    picks_per_day: topN,
    hold_days: holdDays,
    updated_at: withTaipeiTimestamp(),
  };

  return { dailyRows, pickRows, summary };
};

const persistRunResult = async (supabase, runId, dailyRows, pickRows, summary) => {
  const { error: deleteDailyError } = await supabase
    .from("quant_run_daily")
    .delete()
    .eq("run_id", runId);
  if (deleteDailyError) {
    throw new Error(`quant_run_daily cleanup failed: ${deleteDailyError.message}`);
  }

  const { error: deletePicksError } = await supabase
    .from("quant_run_picks")
    .delete()
    .eq("run_id", runId);
  if (deletePicksError) {
    throw new Error(`quant_run_picks cleanup failed: ${deletePicksError.message}`);
  }

  for (const chunk of chunkArray(dailyRows, 500)) {
    const { error } = await supabase.from("quant_run_daily").upsert(chunk, {
      onConflict: "run_id,trade_date",
    });
    if (error) {
      throw new Error(`quant_run_daily upsert failed: ${error.message}`);
    }
  }

  for (const chunk of chunkArray(pickRows, 500)) {
    const { error } = await supabase.from("quant_run_picks").upsert(chunk, {
      onConflict: "run_id,trade_date,stock_id",
    });
    if (error) {
      throw new Error(`quant_run_picks upsert failed: ${error.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from("quant_runs")
    .update({
      status: "success",
      summary,
      error_message: null,
      updated_at: withTaipeiTimestamp(),
    })
    .eq("run_id", runId);
  if (updateError) {
    throw new Error(`quant_runs success update failed: ${updateError.message}`);
  }
};

const failRun = async (supabase, runId, errorMessage) => {
  const { error } = await supabase
    .from("quant_runs")
    .update({
      status: "failed",
      error_message: `${errorMessage}`.slice(0, 800),
      updated_at: withTaipeiTimestamp(),
    })
    .eq("run_id", runId);
  if (error) {
    throw new Error(`quant_runs failed update failed: ${error.message}`);
  }
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing required env vars" });
    return;
  }

  if (CRON_SECRET) {
    const secret = req.headers["x-cron-secret"] || req.query?.secret;
    const isCron = isVercelCronRequest(req);
    if (!isCron && secret !== CRON_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const params = parseParams(req);
  const maxRuns = clampInt(params.max_runs || params.maxRuns, 1, 1, 5);
  const runId = `${params.run_id || params.runId || ""}`.trim() || null;
  const dryRun = `${params.dry_run || params.dryRun || ""}` === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const queued = await fetchQueuedRuns(supabase, runId, maxRuns);
    if (!queued.length) {
      res.status(200).json({ status: "ok", processed: 0, message: "no queued runs" });
      return;
    }

    let processed = 0;
    let success = 0;
    const failures = [];

    for (const item of queued) {
      const claimed = await claimRun(supabase, item);
      if (!claimed) continue;
      processed += 1;

      try {
        const { data: strategy, error: strategyError } = await supabase
          .from("quant_strategies")
          .select("strategy_id,name,params")
          .eq("strategy_id", claimed.strategy_id)
          .single();
        if (strategyError || !strategy) {
          throw new Error(
            `quant_strategies not found for ${claimed.strategy_id}: ${
              strategyError?.message || "unknown"
            }`
          );
        }

        const strategyParams = parseStrategyParams(strategy.params);
        const result = await computeRun(supabase, claimed, strategyParams);

        if (!dryRun) {
          await persistRunResult(
            supabase,
            claimed.run_id,
            result.dailyRows,
            result.pickRows,
            result.summary
          );
        } else {
          await supabase
            .from("quant_runs")
            .update({
              status: "queued",
              summary: result.summary,
              updated_at: withTaipeiTimestamp(),
            })
            .eq("run_id", claimed.run_id);
        }
        success += 1;
      } catch (error) {
        await failRun(supabase, claimed.run_id, error.message || "run failed");
        failures.push({
          run_id: claimed.run_id,
          error: error.message || "run failed",
        });
      }
    }

    res.status(200).json({
      status: "ok",
      processed,
      success,
      failed: failures.length,
      failures: failures.slice(0, 20),
      dryRun,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
