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

const addDays = (dateString, days) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const raw = `${value}`.replace(/,/g, "").trim();
  if (!raw || raw === "--" || raw === "-") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchFinmindPrices = async (
  token,
  dataset,
  stockId,
  startDate,
  endDate,
  retry = 2
) => {
  const url = new URL(FINMIND_ENDPOINT);
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("data_id", stockId);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    if (response.status === 429 && retry > 0) {
      await sleep(1000);
      return fetchFinmindPrices(token, dataset, stockId, startDate, endDate, retry - 1);
    }
    throw new Error(`FinMind request failed ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
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

const upsertRows = async (supabase, table, rows, chunkSize, onConflict) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
};

const fetchStockIds = async (supabase, markets, offset, limit) => {
  const { data, error } = await supabase
    .from("stocks")
    .select("stock_id")
    .in("market", markets)
    .eq("is_active", true)
    .order("stock_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) {
    throw new Error(`Supabase stocks query failed: ${error.message}`);
  }
  return (data || []).map((row) => `${row.stock_id}`.trim()).filter(Boolean);
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

const loadState = async (supabase, source, dataset) => {
  const { data, error } = await supabase
    .from("stock_price_backfill_state")
    .select("*")
    .eq("source", source)
    .eq("dataset", dataset)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(`Backfill state query failed: ${error.message}`);
  }
  return data || null;
};

const upsertState = async (supabase, stateId, payload) => {
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

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET } = process.env;
  if (CRON_SECRET) {
    const secret = req.headers["x-cron-secret"] || req.query?.secret;
    if (secret !== CRON_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing required env vars" });
    return;
  }

  const params = parseParams(req);
  const source = `${params.source || process.env.BACKFILL_SOURCE || "finmind"}`.toLowerCase();
  const dataset = `${params.dataset || process.env.BACKFILL_DATASET || "TaiwanStockPrice"}`.trim();
  const startDateParam = params.start_date || process.env.BACKFILL_START_DATE;
  const endDateParam =
    params.end_date || process.env.BACKFILL_END_DATE || formatDate(new Date());
  const maxStocks = Number(
    params.max_stocks || process.env.BACKFILL_MAX_STOCKS || 200
  );
  const chunkSize = Number(
    params.chunk_size || process.env.BACKFILL_CHUNK_SIZE || 500
  );
  const sleepMs = Number(params.sleep_ms || process.env.BACKFILL_SLEEP_MS || 250);
  const markets = (params.markets || process.env.BACKFILL_MARKETS || "上市,上櫃")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const dryRun = `${params.dry_run || ""}` === "1";
  const reset = `${params.reset || ""}` === "1";
  const autoExtend =
    `${params.auto_extend || process.env.BACKFILL_AUTO_EXTEND || "1"}` === "1";

  let supabase = null;
  let logId = null;

  try {
    if (source !== "finmind") {
      res.status(400).json({ error: "Backfill only supports FinMind source." });
      return;
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let state = reset ? null : await loadState(supabase, source, dataset);
    if (!state) {
      if (!startDateParam) {
        res.status(400).json({ error: "Missing BACKFILL_START_DATE" });
        return;
      }
      const initialState = {
        source,
        dataset,
        start_date: startDateParam,
        end_date: endDateParam,
        current_date: startDateParam,
        stock_offset: 0,
        max_stocks: maxStocks,
        status: "running",
        detail: {
          markets,
          created_by: reset ? "reset" : "auto",
        },
      };
      if (!dryRun) {
        state = await upsertState(supabase, null, initialState);
      } else {
        state = { ...initialState, state_id: null };
      }
    }

    const today = formatDate(new Date());
    let endDate = state.end_date || endDateParam;
    if (autoExtend && today > endDate) {
      endDate = today;
      if (!dryRun) {
        state = await upsertState(supabase, state.state_id, {
          end_date: endDate,
          status: state.status === "completed" ? "running" : state.status,
        });
      }
    }

    let currentDate = state.current_date;
    let stockOffset = state.stock_offset || 0;

    if (currentDate > endDate) {
      if (!dryRun) {
        state = await upsertState(supabase, state.state_id, {
          status: autoExtend ? "idle" : "completed",
          finished_at: autoExtend ? null : new Date().toISOString(),
        });
      }
      res.status(200).json({
        status: autoExtend ? "idle" : "completed",
        message: "Backfill already caught up.",
        state,
      });
      return;
    }

    if (state.status !== "running" && !dryRun) {
      state = await upsertState(supabase, state.state_id, { status: "running" });
    }

    const token = requiredEnv("FINMIND_TOKEN");

    const stockIds = await fetchStockIds(supabase, markets, stockOffset, maxStocks);
    if (!stockIds.length) {
      if (stockOffset === 0) {
        throw new Error("No active stocks found for markets.");
      }
      currentDate = addDays(currentDate, 1);
      stockOffset = 0;
      const status = currentDate > endDate ? (autoExtend ? "idle" : "completed") : "running";
      if (!dryRun) {
        state = await upsertState(supabase, state.state_id, {
          current_date: currentDate,
          stock_offset: stockOffset,
          status,
          finished_at: status === "completed" ? new Date().toISOString() : null,
          detail: {
            ...state.detail,
            last_run: { note: "Reached end of stock list", date: currentDate },
          },
        });
      }
      res.status(200).json({
        status,
        message: "Reached end of stock list for this date.",
        state,
      });
      return;
    }

    if (!dryRun) {
      logId = await createSyncLog(supabase, {
        source,
        start_date: currentDate,
        end_date: currentDate,
        status: "running",
        detail: {
          params: {
            dataset,
            markets,
            stockOffset,
            maxStocks,
          },
        },
      });
    }

    const summary = [];
    let totalRows = 0;
    for (const stockId of stockIds) {
      let rows = [];
      let errorMessage = null;
      try {
        const raw = await fetchFinmindPrices(token, dataset, stockId, currentDate, currentDate);
        rows = parseFinmindRows(raw, stockId);
        if (!dryRun && rows.length) {
          await upsertRows(
            supabase,
            "stock_prices",
            rows,
            chunkSize,
            "stock_id,trade_date"
          );
        }
        totalRows += rows.length;
      } catch (error) {
        errorMessage = error.message;
      }
      summary.push({ stock_id: stockId, rows: rows.length, error: errorMessage });
      if (sleepMs > 0) {
        await sleep(sleepMs);
      }
    }

    let nextDate = currentDate;
    let nextOffset = stockOffset + stockIds.length;
    if (stockIds.length < maxStocks) {
      nextDate = addDays(currentDate, 1);
      nextOffset = 0;
    }

    const status = nextDate > endDate ? (autoExtend ? "idle" : "completed") : "running";
    if (!dryRun) {
      state = await upsertState(supabase, state.state_id, {
        current_date: nextDate,
        stock_offset: nextOffset,
        max_stocks: maxStocks,
        end_date: endDate,
        status,
        finished_at: status === "completed" ? new Date().toISOString() : null,
        detail: {
          ...state.detail,
          last_run: {
            date: currentDate,
            stock_offset: stockOffset,
            total_rows: totalRows,
            summary,
          },
        },
      });
    }

    if (!dryRun) {
      await updateSyncLog(supabase, logId, {
        status: "success",
        total_rows: totalRows,
        finished_at: new Date().toISOString(),
        detail: {
          params: {
            dataset,
            markets,
            stockOffset,
            maxStocks,
          },
          summary,
        },
      });
    }

    res.status(200).json({
      status: "ok",
      source,
      dataset,
      date: currentDate,
      totalRows,
      stockOffset,
      maxStocks,
      nextDate,
      nextOffset,
      dryRun,
      summary,
    });
  } catch (error) {
    if (supabase && logId && !dryRun) {
      await updateSyncLog(supabase, logId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        detail: { error: error.message },
      });
    }
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
