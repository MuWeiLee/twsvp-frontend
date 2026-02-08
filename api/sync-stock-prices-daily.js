import { createClient } from "@supabase/supabase-js";

const FINMIND_ENDPOINT =
  process.env.FINMIND_ENDPOINT || "https://api.finmindtrade.com/api/v4/data";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const pad2 = (value) => `${value}`.padStart(2, "0");

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const raw = `${value}`.replace(/,/g, "").trim();
  if (!raw || raw === "--" || raw === "-") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
};

const resolveSleepMs = (explicitValue, rateLimitPerHour, fallbackMs = 250) => {
  if (Number.isFinite(explicitValue)) return explicitValue;
  const limit = Number(rateLimitPerHour);
  if (Number.isFinite(limit) && limit > 0) {
    return Math.ceil(3600000 / limit);
  }
  return fallbackMs;
};

const resolveMaxRuntimeMs = (explicitValue, fallbackMs = 290000) => {
  const parsed = Number(explicitValue);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallbackMs;
};

const resolveRequestOverheadMs = (explicitValue, fallbackMs = 1000) => {
  const parsed = Number(explicitValue);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallbackMs;
};

const applyRuntimeLimit = (requestedMax, sleepMs, overheadMs, maxRuntimeMs) => {
  const perRequestMs = Math.max(0, sleepMs) + Math.max(0, overheadMs);
  if (!Number.isFinite(perRequestMs) || perRequestMs <= 0) return requestedMax;
  const safetyMs = 5000;
  const budget = Math.max(0, maxRuntimeMs - safetyMs);
  const safeMax = Math.max(1, Math.floor(budget / perRequestMs));
  return Math.max(1, Math.min(requestedMax, safeMax));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseIsoTime = (value) => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const isRecentlyUpdated = (value, staleMinutes) => {
  const ts = parseIsoTime(value);
  if (!ts) return false;
  return Date.now() - ts <= staleMinutes * 60 * 1000;
};

const fetchFinmindPrices = async (token, stockId, tradeDate, retry = 2) => {
  const url = new URL(FINMIND_ENDPOINT);
  url.searchParams.set("dataset", "TaiwanStockPrice");
  url.searchParams.set("data_id", stockId);
  url.searchParams.set("start_date", tradeDate);
  url.searchParams.set("end_date", tradeDate);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    if (response.status === 429 && retry > 0) {
      await sleep(1000);
      return fetchFinmindPrices(token, stockId, tradeDate, retry - 1);
    }
    throw new Error(`FinMind request failed ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (payload?.status && payload.status !== 200) {
    throw new Error(`FinMind response status ${payload.status} ${payload.msg || ""}`.trim());
  }
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("FinMind response invalid");
  }
  return payload.data;
};

const parseFinmindRows = (rows, stockId) =>
  rows
    .map((item) => {
      const tradeDate = item.date || item.trade_date;
      if (!tradeDate) return null;
      const volume = normalizeNumber(
        item.Trading_Volume ?? item.trading_volume ?? item.volume ?? item.Volume
      );
      const turnover = normalizeNumber(
        item.Trading_money ?? item.trading_money ?? item.turnover ?? item.Turnover
      );
      let average = normalizeNumber(
        item.average ?? item.avg_price ?? item.price_avg ?? item.average_price
      );
      if (average === null && volume && turnover) {
        average = Number((turnover / volume).toFixed(4));
      }
      return {
        stock_id: stockId,
        trade_date: tradeDate,
        open: normalizeNumber(
          item.open ?? item.adj_open ?? item.Open ?? item.AdjOpen ?? item.Adj_Open
        ),
        high: normalizeNumber(
          item.max ?? item.high ?? item.adj_high ?? item.High ?? item.AdjHigh ?? item.Adj_High
        ),
        low: normalizeNumber(
          item.min ?? item.low ?? item.adj_low ?? item.Low ?? item.AdjLow ?? item.Adj_Low
        ),
        close: normalizeNumber(
          item.close ?? item.adj_close ?? item.Close ?? item.AdjClose ?? item.Adj_Close
        ),
        average,
        volume: volume === null ? null : Math.trunc(volume),
        turnover,
      };
    })
    .filter(Boolean);

const upsertRows = async (supabase, rows, chunkSize) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("stock_prices")
      .upsert(chunk, { onConflict: "stock_id,trade_date" });
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
};

const fetchStockIds = async (supabase, markets, offset, limit, includeInactive) => {
  let query = supabase
    .from("stocks")
    .select("stock_id")
    .in("market", markets)
    .order("stock_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase stocks query failed: ${error.message}`);
  }
  return (data || []).map((row) => `${row.stock_id}`.trim()).filter(Boolean);
};

const countStocks = async (supabase, markets, includeInactive) => {
  let query = supabase
    .from("stocks")
    .select("stock_id", { count: "exact", head: true })
    .in("market", markets);
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`Supabase stocks count failed: ${error.message}`);
  }
  return count || 0;
};

const createSyncLog = async (supabase, payload) => {
  try {
    const { data, error } = await supabase
      .from("stock_price_sync_logs")
      .insert(payload)
      .select("log_id")
      .single();
    if (error) return null;
    return data?.log_id || null;
  } catch (error) {
    return null;
  }
};

const updateSyncLog = async (supabase, logId, payload) => {
  if (!logId) return;
  try {
    await supabase.from("stock_price_sync_logs").update(payload).eq("log_id", logId);
  } catch (error) {
    return;
  }
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

const loadDailyState = async (supabase, tradeDate) => {
  const { data, error } = await supabase
    .from("stock_price_backfill_state")
    .select("*")
    .eq("source", "finmind")
    .eq("dataset", "TaiwanStockPrice")
    .eq("cursor_date", tradeDate)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(`Backfill state query failed: ${error.message}`);
  }
  return data || null;
};

const upsertDailyState = async (supabase, stateId, payload) => {
  if (!stateId) {
    const { data, error } = await supabase
      .from("stock_price_backfill_state")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      throw new Error(`Backfill state insert failed: ${error.message}`);
    }
    return data;
  }
  const { data, error } = await supabase
    .from("stock_price_backfill_state")
    .update(payload)
    .eq("state_id", stateId)
    .select("*")
    .single();
  if (error) {
    throw new Error(`Backfill state update failed: ${error.message}`);
  }
  return data;
};

const closeOtherRunningDailyStates = async (supabase, tradeDate, keepStateId = null) => {
  let query = supabase
    .from("stock_price_backfill_state")
    .update({
      status: "superseded",
      finished_at: new Date().toISOString(),
      detail: { reason: "superseded_by_reset", mode: "daily", tradeDate },
    })
    .eq("source", "finmind")
    .eq("dataset", "TaiwanStockPrice")
    .eq("cursor_date", tradeDate)
    .eq("status", "running");
  if (keepStateId) {
    query = query.neq("state_id", keepStateId);
  }
  await query;
};

const hasActiveDailyConflict = async (
  supabase,
  tradeDate,
  keepStateId,
  staleMinutes = 20
) => {
  let query = supabase
    .from("stock_price_backfill_state")
    .select("state_id,status,updated_at")
    .eq("source", "finmind")
    .eq("dataset", "TaiwanStockPrice")
    .eq("cursor_date", tradeDate)
    .eq("status", "running")
    .order("updated_at", { ascending: false })
    .limit(5);
  if (keepStateId) {
    query = query.neq("state_id", keepStateId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Backfill state conflict query failed: ${error.message}`);
  }
  return (data || []).some((item) => isRecentlyUpdated(item.updated_at, staleMinutes));
};

const recordMissingDaily = async (
  supabase,
  stockId,
  tradeDate,
  errorMessage = null
) => {
  const payload = {
    source: "finmind",
    dataset: "TaiwanStockPrice",
    stock_id: stockId,
    trade_date: tradeDate,
    reason: errorMessage || "empty_response",
    detail: {
      mode: "daily",
      error: errorMessage,
    },
  };
  try {
    await supabase.from("stock_price_missing").upsert(payload, {
      onConflict: "source,dataset,stock_id,trade_date",
    });
  } catch (_) {
    return;
  }
};

const isTradingDay = async (supabase, tradeDate) => {
  const { data, error } = await supabase
    .from("trading_calendar")
    .select("trade_date")
    .eq("trade_date", tradeDate)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Trading calendar query failed: ${error.message}`);
  }
  return Boolean(data?.trade_date);
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

  const params = parseParams(req);
  const tradeDate = `${params.trade_date || params.tradeDate || formatDate(new Date())}`;
  const chunkSize = Number(params.chunk_size || params.chunkSize || 500);
  const rateLimitPerHour =
    params.rate_limit_per_hour || process.env.STOCK_PRICE_SYNC_RATE_LIMIT_PER_HOUR || 600;
  const sleepMs = resolveSleepMs(
    params.sleep_ms ? Number(params.sleep_ms) : Number(params.sleepMs),
    rateLimitPerHour,
    250
  );
  const markets = (params.markets || "上市,上櫃,興櫃")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const includeInactive =
    `${params.include_inactive || process.env.STOCK_PRICE_SYNC_INCLUDE_INACTIVE || "1"}` ===
    "1";
  const maxStocks = Number(
    params.max_stocks || params.maxStocks || process.env.STOCK_PRICE_DAILY_MAX_STOCKS || 200
  );
  const reset = `${params.reset || ""}` === "1";
  const maxRuntimeMs = resolveMaxRuntimeMs(
    params.max_runtime_ms || process.env.STOCK_PRICE_DAILY_MAX_RUNTIME_MS,
    290000
  );
  const requestOverheadMs = resolveRequestOverheadMs(
    params.request_overhead_ms || process.env.STOCK_PRICE_DAILY_REQUEST_OVERHEAD_MS,
    1000
  );
  const conflictStaleMinutes = Number(
    params.conflict_stale_minutes || process.env.STOCK_PRICE_CONFLICT_STALE_MINUTES || 20
  );

  let supabase = null;
  let logId = null;

  try {
    const token = requiredEnv("FINMIND_TOKEN");
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const isTradeDay = await isTradingDay(supabase, tradeDate);
    if (!isTradeDay) {
      res.status(200).json({ status: "skip", tradeDate, reason: "non-trading-day" });
      return;
    }

    let state = await loadDailyState(supabase, tradeDate);
    if (state?.status === "running") {
      await closeOtherRunningDailyStates(supabase, tradeDate, state.state_id);
    }
    if (reset || !state || state.status !== "running") {
      if (reset) {
        await closeOtherRunningDailyStates(supabase, tradeDate, state?.state_id || null);
      }
      state = await upsertDailyState(supabase, state?.state_id || null, {
        source: "finmind",
        dataset: "TaiwanStockPrice",
        start_date: tradeDate,
        end_date: tradeDate,
        cursor_date: tradeDate,
        stock_offset: 0,
        max_stocks: maxStocks,
        status: "running",
        detail: { mode: "daily" },
      });
    }

    const hasConflict = await hasActiveDailyConflict(
      supabase,
      tradeDate,
      state?.state_id || null,
      conflictStaleMinutes
    );
    if (hasConflict) {
      res.status(409).json({
        error: "Daily sync conflict detected",
        detail: "Another running daily state is active recently.",
        tradeDate,
      });
      return;
    }

    const totalStocks = await countStocks(supabase, markets, includeInactive);
    if (state.stock_offset >= totalStocks) {
      await upsertDailyState(supabase, state.state_id, {
        status: "done",
        finished_at: new Date().toISOString(),
        detail: { mode: "daily", totalStocks },
      });
      res.status(200).json({ status: "done", tradeDate, totalStocks });
      return;
    }

    logId = await createSyncLog(supabase, {
      source: "finmind",
      start_date: tradeDate,
      end_date: tradeDate,
      status: "running",
      detail: {
        mode: "daily",
        tradeDate,
        offset: state.stock_offset,
        maxStocks: applyRuntimeLimit(maxStocks, sleepMs, requestOverheadMs, maxRuntimeMs),
        rateLimitPerHour,
      },
    });

  const effectiveMaxStocks = applyRuntimeLimit(
    maxStocks,
    sleepMs,
    requestOverheadMs,
    maxRuntimeMs
  );
  const stockIds = await fetchStockIds(
    supabase,
    markets,
    state.stock_offset,
    effectiveMaxStocks,
    includeInactive
  );

    const summary = [];
    let totalRows = 0;
    let rateLimited = false;
    for (const stockId of stockIds) {
      let errorMessage = null;
      let rows = [];
      try {
        const raw = await fetchFinmindPrices(token, stockId, tradeDate);
        rows = parseFinmindRows(raw, stockId);
        if (rows.length) {
          await upsertRows(supabase, rows, chunkSize);
        }
        totalRows += rows.length;
      } catch (error) {
        errorMessage = error.message;
        if (
          errorMessage &&
          /402|403|429|Payment Required|rate limit|quota/i.test(errorMessage)
        ) {
          rateLimited = true;
        }
      }
      summary.push({ stock_id: stockId, rows: rows.length, error: errorMessage });
      if (!dryRun && (!rows.length || errorMessage)) {
        await recordMissingDaily(supabase, stockId, tradeDate, errorMessage);
      }
      if (rateLimited) break;
      if (sleepMs > 0) {
        await sleep(sleepMs);
      }
    }

    if (rateLimited) {
      await upsertDailyState(supabase, state.state_id, {
        status: "rate_limited",
        detail: {
          mode: "daily",
          tradeDate,
          totalStocks,
          last_run: {
            offset: state.stock_offset,
            total_rows: totalRows,
            summary,
            error: "rate_limited",
          },
        },
      });

      await updateSyncLog(supabase, logId, {
        status: "rate_limited",
        total_rows: totalRows,
        finished_at: new Date().toISOString(),
        detail: { mode: "daily", tradeDate, offset: state.stock_offset, summary },
      });

      res.status(429).json({
        status: "rate_limited",
        tradeDate,
        totalRows,
        offset: state.stock_offset,
        nextOffset: state.stock_offset,
        totalStocks,
        batch: stockIds.length,
        summary,
      });
      return;
    }

    const nextOffset = state.stock_offset + stockIds.length;
    const nextStatus = nextOffset >= totalStocks ? "done" : "running";
    await upsertDailyState(supabase, state.state_id, {
      stock_offset: nextOffset,
      max_stocks: maxStocks,
      status: nextStatus,
      finished_at: nextStatus === "done" ? new Date().toISOString() : null,
      detail: { mode: "daily", totalStocks, lastBatch: stockIds.length },
    });

    await updateSyncLog(supabase, logId, {
      status: "success",
      total_rows: totalRows,
      finished_at: new Date().toISOString(),
      detail: { mode: "daily", tradeDate, offset: state.stock_offset, summary },
    });

    res.status(200).json({
      status: "ok",
      tradeDate,
      totalRows,
      offset: state.stock_offset,
      nextOffset,
      totalStocks,
      batch: stockIds.length,
    });
  } catch (error) {
    if (supabase && logId) {
      await updateSyncLog(supabase, logId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        detail: { error: error.message },
      });
    }
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
