import { createClient } from "@supabase/supabase-js";

const TWSE_ENDPOINT =
  process.env.TWSE_ENDPOINT || "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_ENDPOINT =
  process.env.TPEX_ENDPOINT ||
  "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php";
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

const formatDateParam = (date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}${month}${day}`;
};

const formatRocDate = (date, padMonth = true) => {
  const rocYear = date.getFullYear() - 1911;
  const month = padMonth ? pad2(date.getMonth() + 1) : date.getMonth() + 1;
  const day = padMonth ? pad2(date.getDate()) : date.getDate();
  return `${rocYear}/${month}/${day}`;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  if (text.trim().startsWith("<")) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const raw = `${value}`.replace(/,/g, "").trim();
  if (!raw || raw === "--" || raw === "-") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return formatDate(date);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getDateRange = (start, end) => {
  const dates = [];
  const cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const fetchTwseDaily = async (date) => {
  const url = new URL(TWSE_ENDPOINT);
  url.searchParams.set("date", formatDateParam(date));
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) {
    throw new Error(`TWSE request failed ${response.status} ${response.statusText}`);
  }
  const payload = await parseJson(response);
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload;
};

const fetchFinmindPrices = async (token, stockId, startDate, endDate, retry = 2) => {
  const url = new URL(FINMIND_ENDPOINT);
  url.searchParams.set("dataset", "TaiwanStockPrice");
  url.searchParams.set("data_id", stockId);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("token", token);

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 429 && retry > 0) {
      await sleep(1000);
      return fetchFinmindPrices(token, stockId, startDate, endDate, retry - 1);
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
        open: normalizeNumber(item.open ?? item.Open),
        high: normalizeNumber(item.max ?? item.high ?? item.High),
        low: normalizeNumber(item.min ?? item.low ?? item.Low),
        close: normalizeNumber(item.close ?? item.Close),
        average,
        volume: volume === null ? null : Math.trunc(volume),
        turnover,
      };
    })
    .filter(Boolean);

const fetchTpexDaily = async (date) => {
  const attempt = async (padMonth) => {
    const url = new URL(TPEX_ENDPOINT);
    url.searchParams.set("l", "zh-tw");
    url.searchParams.set("d", formatRocDate(date, padMonth));
    url.searchParams.set("se", "EW");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.tpex.org.tw/",
      },
    });
    if (!response.ok) {
      throw new Error(`TPEx request failed ${response.status} ${response.statusText}`);
    }
    const payload = await parseJson(response);
    if (!payload) return null;
    return payload;
  };

  const padded = await attempt(true);
  if (padded && (padded.aaData || padded.data || padded.table)) return padded;
  return attempt(false);
};

const parseTwseRows = (rows, tradeDate) =>
  rows
    .map((row) => {
      const stockId = `${row.Code || row.code || ""}`.trim();
      const name = `${row.Name || row.name || ""}`.trim();
      if (!stockId || !name) return null;
      const volume = normalizeNumber(row.TradeVolume);
      const turnover = normalizeNumber(row.TradeValue);
      let average = null;
      if (volume && turnover) {
        average = Number((turnover / volume).toFixed(4));
      }
      return {
        stock: {
          stock_id: stockId,
          name,
          market: "上市",
          industry: null,
          is_active: true,
        },
        price: {
          stock_id: stockId,
          trade_date: tradeDate,
          open: normalizeNumber(row.OpeningPrice),
          high: normalizeNumber(row.HighestPrice),
          low: normalizeNumber(row.LowestPrice),
          close: normalizeNumber(row.ClosingPrice),
          average,
          volume: volume === null ? null : Math.trunc(volume),
          turnover,
        },
      };
    })
    .filter(Boolean);

const parseTpexRows = (payload, tradeDate) => {
  const rows = payload?.aaData || payload?.data || payload?.table || [];
  const fields = payload?.fields || payload?.field || payload?.title || [];
  let idxCode = fields.findIndex((field) => `${field}`.includes("代號"));
  let idxName = fields.findIndex((field) => `${field}`.includes("名稱"));
  let idxClose = fields.findIndex((field) => `${field}`.includes("收盤"));
  let idxOpen = fields.findIndex((field) => `${field}`.includes("開盤"));
  let idxHigh = fields.findIndex((field) => `${field}`.includes("最高"));
  let idxLow = fields.findIndex((field) => `${field}`.includes("最低"));
  let idxVolume = fields.findIndex((field) => `${field}`.includes("成交股數"));
  let idxTurnover = fields.findIndex((field) => `${field}`.includes("成交金額"));

  if (idxCode < 0) {
    idxCode = 0;
    idxName = 1;
    idxClose = 2;
    idxOpen = 4;
    idxHigh = 5;
    idxLow = 6;
    idxVolume = 7;
    idxTurnover = 8;
  }

  return rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const stockId = `${row[idxCode] || ""}`.trim();
      const name = `${row[idxName] || ""}`.trim();
      if (!stockId || !name) return null;
      const volume = normalizeNumber(row[idxVolume]);
      const turnover = normalizeNumber(row[idxTurnover]);
      let average = null;
      if (volume && turnover) {
        average = Number((turnover / volume).toFixed(4));
      }
      return {
        stock: {
          stock_id: stockId,
          name,
          market: "上櫃",
          industry: null,
          is_active: true,
        },
        price: {
          stock_id: stockId,
          trade_date: tradeDate,
          open: normalizeNumber(row[idxOpen]),
          high: normalizeNumber(row[idxHigh]),
          low: normalizeNumber(row[idxLow]),
          close: normalizeNumber(row[idxClose]),
          average,
          volume: volume === null ? null : Math.trunc(volume),
          turnover,
        },
      };
    })
    .filter(Boolean);
};

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
  const source = `${params.source || "public"}`.toLowerCase();
  const startDate = params.start_date || params.startDate || getDefaultStartDate();
  const endDate = params.end_date || params.endDate || formatDate(new Date());
  const maxDays = Number(params.max_days || params.maxDays || 31);
  const chunkSize = Number(params.chunk_size || params.chunkSize || 500);
  const sleepMs = Number(params.sleep_ms || params.sleepMs || 250);
  const dryRun = `${params.dry_run || params.dryRun || ""}` === "1";
  const markets = (params.markets || "上市,上櫃")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const stockIdParam = `${params.stock_id || params.stockId || ""}`.trim();
  const stockIdsParam = `${params.stock_ids || params.stockIds || ""}`
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const stockOffset = Number(params.stock_offset || params.stockOffset || 0);
  const maxStocks = Number(params.max_stocks || params.maxStocks || 200);

  const logParams = {
    markets,
    maxDays,
    chunkSize,
    stockId: stockIdParam || null,
    stockIds: stockIdsParam.length ? stockIdsParam : null,
    stockOffset,
    maxStocks,
  };

  let supabase = null;
  let logId = null;

  try {
    const dates = getDateRange(startDate, endDate);
    if (dates.length > maxDays) {
      res.status(400).json({
        error: "Date range too large",
        detail: `Range ${dates.length} days exceeds max_days ${maxDays}.`,
      });
      return;
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

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
    if (source === "finmind") {
      const token = requiredEnv("FINMIND_TOKEN");
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
          const raw = await fetchFinmindPrices(token, stockId, startDate, endDate);
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
    } else {
      for (const date of dates) {
        const tradeDate = formatDate(date);
        let twseRows = [];
        let tpexRows = [];
        let twseError = null;
        let tpexError = null;

        try {
          const twse = await fetchTwseDaily(date);
          twseRows = parseTwseRows(twse, tradeDate);
        } catch (error) {
          twseError = error.message;
        }

        try {
          const tpex = await fetchTpexDaily(date);
          if (tpex) {
            tpexRows = parseTpexRows(tpex, tradeDate);
          }
        } catch (error) {
          tpexError = error.message;
        }

        const combined = [...twseRows, ...tpexRows];
        const stockRows = combined.map((row) => row.stock);
        const priceRows = combined.map((row) => row.price);

        if (!dryRun && combined.length) {
          await upsertRows(supabase, "stocks", stockRows, chunkSize, "stock_id");
          await upsertRows(
            supabase,
            "stock_prices",
            priceRows,
            chunkSize,
            "stock_id,trade_date"
          );
        }

        totalRows += priceRows.length;
        summary.push({
          date: tradeDate,
          rows: priceRows.length,
          twseError,
          tpexError,
        });

        if (sleepMs > 0) {
          await sleep(sleepMs);
        }
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
      stockOffset: source === "finmind" ? stockOffset : undefined,
      maxStocks: source === "finmind" ? maxStocks : undefined,
      dryRun,
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
