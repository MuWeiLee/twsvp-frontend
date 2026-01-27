import { createClient } from "@supabase/supabase-js";

const FINMIND_ENDPOINT =
  process.env.FINMIND_ENDPOINT || "https://api.finmindtrade.com/api/v4/data";
const MIN_START_DATE = process.env.STOCK_PRICE_MIN_START_DATE || "2026-01-01";

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

const getDefaultStartDate = () => process.env.STOCK_PRICE_SYNC_START_DATE || MIN_START_DATE;

const clampStartDate = (value) => {
  if (!value) return MIN_START_DATE;
  return value < MIN_START_DATE ? MIN_START_DATE : value;
};

const normalizeDateRange = (startDate, endDate) => {
  const safeStart = clampStartDate(startDate);
  const safeEnd = endDate && endDate < safeStart ? safeStart : endDate;
  return { startDate: safeStart, endDate: safeEnd || safeStart };
};

const fetchLatestTradeDate = async (supabase) => {
  const { data, error } = await supabase
    .from("stock_prices")
    .select("trade_date")
    .order("trade_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("读取 stock_prices 最新日期失败:", error);
    return null;
  }
  return data?.trade_date || null;
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
  const source = `${params.source || "finmind"}`.toLowerCase();
  const explicitStartDate = params.start_date || params.startDate || null;
  const rawEndDate = params.end_date || params.endDate || formatDate(new Date());
  const chunkSize = Number(params.chunk_size || params.chunkSize || 500);
  const sleepMs = Number(params.sleep_ms || params.sleepMs || 250);
  const incremental =
    `${params.incremental || params.incremental_sync || process.env.STOCK_PRICE_SYNC_INCREMENTAL || "1"}` ===
    "1";
  const dryRun = `${params.dry_run || params.dryRun || ""}` === "1";
  const purge = `${params.purge || params.purge_prices || ""}` === "1";
  const purgeAll = `${params.purge_all || params.purgeAll || ""}` === "1";
  const purgeConfirm = `${params.purge_confirm || params.purgeConfirm || ""}`;
  const markets = (params.markets || "上市,上櫃")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const dataset = `${params.dataset || "TaiwanStockPrice"}`.trim();
  const stockIdParam = `${params.stock_id || params.stockId || ""}`.trim();
  const stockIdsParam = `${params.stock_ids || params.stockIds || ""}`
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const stockOffset = Number(params.stock_offset || params.stockOffset || 0);
  const maxStocks = Number(params.max_stocks || params.maxStocks || 200);

  const logParams = {
    dataset,
    markets,
    chunkSize,
    stockId: stockIdParam || null,
    stockIds: stockIdsParam.length ? stockIdsParam : null,
    stockOffset,
    maxStocks,
    purge,
    purgeAll,
    incremental,
    minStartDate: MIN_START_DATE,
  };

  let supabase = null;
  let logId = null;

  try {
    if (source !== "finmind") {
      res.status(400).json({ error: "Only finmind source is supported." });
      return;
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let resolvedStartDate = explicitStartDate;
    if (!resolvedStartDate && incremental) {
      resolvedStartDate = await fetchLatestTradeDate(supabase);
    }
    const { startDate, endDate } = normalizeDateRange(
      resolvedStartDate || getDefaultStartDate(),
      rawEndDate
    );

    logId = dryRun
      ? null
      : await createSyncLog(supabase, {
          source,
          start_date: startDate,
          end_date: endDate,
          status: "running",
          detail: { params: logParams },
        });

    const summary = [];
    let totalRows = 0;
    const token = requiredEnv("FINMIND_TOKEN");
    if (purgeAll && !dryRun) {
      if (purgeConfirm !== "DELETE_ALL") {
        res.status(400).json({ error: "Missing purge_confirm=DELETE_ALL for purge_all." });
        return;
      }
      const { error } = await supabase.from("stock_prices").delete().neq("stock_id", "");
      if (error) {
        throw new Error(`Stock price purge all failed: ${error.message}`);
      }
    }
    let stockIds = [];
    if (stockIdParam) {
      stockIds = [stockIdParam];
    } else if (stockIdsParam.length) {
      stockIds = stockIdsParam;
    } else {
      stockIds = await fetchStockIds(supabase, markets, stockOffset, maxStocks);
    }

    for (const stockId of stockIds) {
      let errorMessage = null;
      let rows = [];
      try {
        if (purge && !dryRun) {
          const { error } = await supabase
            .from("stock_prices")
            .delete()
            .eq("stock_id", stockId)
            .gte("trade_date", startDate)
            .lte("trade_date", endDate);
          if (error) {
            throw new Error(`Stock price purge failed: ${error.message}`);
          }
        }
        const raw = await fetchFinmindPrices(token, dataset, stockId, startDate, endDate);
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
      summary.push({
        stock_id: stockId,
        rows: rows.length,
        error: errorMessage,
      });
      if (sleepMs > 0) {
        await sleep(sleepMs);
      }
    }

    if (!dryRun) {
      await updateSyncLog(supabase, logId, {
        status: "success",
        total_rows: totalRows,
        finished_at: new Date().toISOString(),
        detail: { params: logParams, summary },
      });
    }

    res.status(200).json({
      status: "ok",
      source,
      startDate,
      endDate,
      totalRows,
      stockOffset,
      maxStocks,
      dryRun,
      purgeAll,
      summary,
    });
  } catch (error) {
    if (supabase && logId && !dryRun) {
      await updateSyncLog(supabase, logId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        detail: { params: logParams, error: error.message },
      });
    }
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
