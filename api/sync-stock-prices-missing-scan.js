import { createClient } from "@supabase/supabase-js";
import { formatDate, getTaipeiDateString } from "./_lib/taipei-date.js";

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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

const fetchStockIdsPage = async (supabase, markets, offset, limit, includeInactive) => {
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

const fetchStockIds = async (
  supabase,
  markets,
  stockOffset,
  maxStocks,
  includeInactive,
  pageSize = 1000
) => {
  if (maxStocks > 0) {
    return fetchStockIdsPage(supabase, markets, stockOffset, maxStocks, includeInactive);
  }

  const result = [];
  let offset = stockOffset;
  while (true) {
    const page = await fetchStockIdsPage(supabase, markets, offset, pageSize, includeInactive);
    if (!page.length) break;
    result.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return result;
};

const fetchTradingDates = async (supabase, startDate, endDate) => {
  const { data, error } = await supabase
    .from("trading_calendar")
    .select("trade_date")
    .gte("trade_date", startDate)
    .lte("trade_date", endDate)
    .order("trade_date", { ascending: true });
  if (error) {
    throw new Error(`Trading calendar query failed: ${error.message}`);
  }
  return (data || []).map((row) => row.trade_date);
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

const fetchExistingDates = async (supabase, stockId, startDate, endDate) => {
  const { data, error } = await supabase
    .from("stock_prices")
    .select("trade_date")
    .eq("stock_id", stockId)
    .gte("trade_date", startDate)
    .lte("trade_date", endDate);
  if (error) {
    throw new Error(`Stock prices query failed: ${error.message}`);
  }
  return new Set((data || []).map((row) => row.trade_date));
};

const buildRanges = (dates) => {
  if (!dates.length) return [];
  const ranges = [];
  let start = dates[0];
  let end = dates[0];
  const addDays = (dateString, days) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return formatDate(date);
  };
  for (let i = 1; i < dates.length; i += 1) {
    const next = dates[i];
    const expected = addDays(end, 1);
    if (next === expected) {
      end = next;
      continue;
    }
    ranges.push({ start_date: start, end_date: end });
    start = next;
    end = next;
  }
  ranges.push({ start_date: start, end_date: end });
  return ranges;
};

const upsertMissingRows = async (supabase, rows) => {
  for (const chunk of chunkArray(rows, 1000)) {
    const { error } = await supabase.from("stock_price_missing").upsert(chunk, {
      onConflict: "stock_id,trade_date",
    });
    if (error) {
      throw new Error(`Missing rows upsert failed: ${error.message}`);
    }
  }
};

const upsertMissingRanges = async (supabase, rows) => {
  for (const chunk of chunkArray(rows, 1000)) {
    const { error } = await supabase.from("stock_price_missing_ranges").upsert(chunk, {
      onConflict: "stock_id,start_date,end_date",
    });
    if (error) {
      throw new Error(`Missing ranges upsert failed: ${error.message}`);
    }
  }
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
  const modeRaw = `${params.mode || params.scan_mode || "scan"}`.trim().toLowerCase();
  const mode = ["trade_date", "daily_init", "daily_pending"].includes(modeRaw)
    ? "trade_date"
    : "scan";
  const startDate =
    params.start_date ||
    params.startDate ||
    process.env.BACKFILL_START_DATE ||
    process.env.STOCK_PRICE_MIN_START_DATE ||
    "2025-01-01";
  const endDate =
    params.end_date ||
    params.endDate ||
    process.env.BACKFILL_END_DATE ||
    getTaipeiDateString();
  const tradeDate = `${params.trade_date || params.tradeDate || getTaipeiDateString()}`;
  const stockOffset = Math.max(0, Number(params.stock_offset || params.stockOffset || 0));
  const requestedMaxStocks = Number(
    params.max_stocks ||
      params.maxStocks ||
      process.env.STOCK_PRICE_MISSING_SCAN_MAX_STOCKS ||
      0
  );
  const maxStocks = Number.isFinite(requestedMaxStocks) ? requestedMaxStocks : 0;
  const includeInactive =
    `${params.include_inactive || process.env.BACKFILL_INCLUDE_INACTIVE || "1"}` === "1";
  const markets = (params.markets || process.env.BACKFILL_MARKETS || "上市,上櫃,興櫃")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const dryRun = `${params.dry_run || ""}` === "1";

  let supabase = null;

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const stockIds = await fetchStockIds(
      supabase,
      markets,
      stockOffset,
      maxStocks,
      includeInactive
    );
    if (!stockIds.length) {
      res.status(200).json({
        status: "ok",
        reason: "no stocks",
        mode,
        stockOffset,
        maxStocks,
      });
      return;
    }

    if (mode === "trade_date") {
      const isTradeDay = await isTradingDay(supabase, tradeDate);
      if (!isTradeDay) {
        res.status(200).json({
          status: "skip",
          reason: "non-trading-day",
          mode,
          tradeDate,
        });
        return;
      }

      if (!dryRun) {
        const payload = stockIds.map((stockId) => ({
          stock_id: stockId,
          trade_date: tradeDate,
          status: "pending",
        }));
        await upsertMissingRows(supabase, payload);
      }

      res.status(200).json({
        status: "ok",
        mode,
        tradeDate,
        stockOffset,
        maxStocks,
        seedRows: stockIds.length,
        dryRun,
      });
      return;
    }

    const tradingDates = await fetchTradingDates(supabase, startDate, endDate);
    if (!tradingDates.length) {
      res.status(200).json({ status: "ok", reason: "no trading dates", startDate, endDate });
      return;
    }

    let missingRows = 0;
    let missingRangeRows = 0;

    for (const stockId of stockIds) {
      const existingDates = await fetchExistingDates(supabase, stockId, startDate, endDate);
      const missingDates = tradingDates.filter((date) => !existingDates.has(date));
      if (!missingDates.length) continue;

      if (!dryRun) {
        const missingPayload = missingDates.map((date) => ({
          stock_id: stockId,
          trade_date: date,
          status: "pending",
        }));
        await upsertMissingRows(supabase, missingPayload);
        missingRows += missingPayload.length;

        const ranges = buildRanges(missingDates);
        if (ranges.length) {
          const rangePayload = ranges.map((range) => ({
            stock_id: stockId,
            start_date: range.start_date,
            end_date: range.end_date,
            status: "pending",
            total_rows: 0,
          }));
          await upsertMissingRanges(supabase, rangePayload);
          missingRangeRows += rangePayload.length;
        }
      }
    }

    res.status(200).json({
      status: "ok",
      mode,
      startDate,
      endDate,
      stockOffset,
      maxStocks,
      scannedStocks: stockIds.length,
      missingRows,
      missingRangeRows,
      dryRun,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
