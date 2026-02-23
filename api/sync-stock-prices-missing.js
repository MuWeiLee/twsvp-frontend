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

const fetchFinmindPrices = async (token, dataset, stockId, startDate, endDate, retry = 2) => {
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

const addDays = (dateString, days) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
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
  const dataset = `${params.dataset || process.env.BACKFILL_DATASET || "TaiwanStockPrice"}`;
  const chunkSize = Number(params.chunk_size || params.chunkSize || 500);
  const rateLimitPerHour =
    params.rate_limit_per_hour || process.env.BACKFILL_RATE_LIMIT_PER_HOUR || 600;
  const sleepMs = resolveSleepMs(
    params.sleep_ms ? Number(params.sleep_ms) : Number(process.env.BACKFILL_SLEEP_MS),
    rateLimitPerHour,
    250
  );
  const maxRuntimeMs = resolveMaxRuntimeMs(
    params.max_runtime_ms || process.env.BACKFILL_MAX_RUNTIME_MS,
    290000
  );
  const requestOverheadMs = resolveRequestOverheadMs(
    params.request_overhead_ms || process.env.BACKFILL_REQUEST_OVERHEAD_MS,
    1000
  );
  const maxRanges = Math.max(1, Number(params.max_ranges || params.maxRanges || 20));
  const maxDates = Math.max(1, Number(params.max_dates || params.maxDates || 60));
  const maxDaysPerRange = Math.max(
    1,
    Number(params.max_days_per_range || params.maxDaysPerRange || 90)
  );
  const mode = `${params.mode || "auto"}`.toLowerCase();

  let supabase = null;

  try {
    const token = requiredEnv("FINMIND_TOKEN");
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const effectiveMaxRanges = applyRuntimeLimit(
      maxRanges,
      sleepMs,
      requestOverheadMs,
      maxRuntimeMs
    );
    const effectiveMaxDates = applyRuntimeLimit(
      maxDates,
      sleepMs,
      requestOverheadMs,
      maxRuntimeMs
    );

    const summary = [];
    let totalRows = 0;
    let processed = 0;
    let rateLimited = false;

    const shouldUseRanges = mode === "range" || mode === "auto";
    const shouldUseDates = mode === "date" || mode === "auto";

    if (shouldUseRanges) {
      const { data: ranges, error } = await supabase
        .from("stock_price_missing_ranges")
        .select("*")
        .eq("status", "pending")
        .order("start_date", { ascending: false })
        .limit(effectiveMaxRanges);
      if (error) {
        throw new Error(`Missing ranges query failed: ${error.message}`);
      }

      for (const range of ranges || []) {
        if (rateLimited) break;
        const startDate = range.start_date;
        let endDate = range.end_date;
        if (maxDaysPerRange > 0) {
          const cappedEnd = addDays(startDate, maxDaysPerRange - 1);
          if (cappedEnd < endDate) {
            endDate = cappedEnd;
          }
        }
        try {
          const raw = await fetchFinmindPrices(
            token,
            dataset,
            range.stock_id,
            startDate,
            endDate
          );
          const rows = parseFinmindRows(raw, range.stock_id);
          if (rows.length) {
            await upsertRows(supabase, rows, chunkSize);
          }
          totalRows += rows.length;
          processed += 1;
          if (rows.length > 0) {
            const finished = endDate >= range.end_date;
            if (finished) {
              await supabase
                .from("stock_price_missing_ranges")
                .update({ status: "done", total_rows: rows.length, last_error: null })
                .eq("range_id", range.range_id);
            } else {
              await supabase
                .from("stock_price_missing_ranges")
                .update({ start_date: addDays(endDate, 1), total_rows: 0, last_error: null })
                .eq("range_id", range.range_id);
            }
          } else {
            await supabase
              .from("stock_price_missing_ranges")
              .update({ status: "pending", total_rows: 0, last_error: "empty_response" })
              .eq("range_id", range.range_id);
          }
          summary.push({
            type: "range",
            stock_id: range.stock_id,
            start_date: startDate,
            end_date: endDate,
            rows: rows.length,
          });
        } catch (error) {
          const message = error.message;
          if (/402|403|429|Payment Required|rate limit|quota/i.test(message)) {
            rateLimited = true;
          }
          await supabase
            .from("stock_price_missing_ranges")
            .update({ status: "failed", last_error: message })
            .eq("range_id", range.range_id);
          summary.push({
            type: "range",
            stock_id: range.stock_id,
            start_date: startDate,
            end_date: endDate,
            rows: 0,
            error: message,
          });
        }
        if (sleepMs > 0) {
          await sleep(sleepMs);
        }
      }
    }

    if (!rateLimited && shouldUseDates) {
      const { data: misses, error } = await supabase
        .from("stock_price_missing")
        .select("*")
        .eq("status", "pending")
        .order("trade_date", { ascending: false })
        .limit(effectiveMaxDates);
      if (error) {
        throw new Error(`Missing dates query failed: ${error.message}`);
      }

      for (const miss of misses || []) {
        if (rateLimited) break;
        try {
          const raw = await fetchFinmindPrices(
            token,
            dataset,
            miss.stock_id,
            miss.trade_date,
            miss.trade_date
          );
          const rows = parseFinmindRows(raw, miss.stock_id);
          if (rows.length) {
            await upsertRows(supabase, rows, chunkSize);
          }
          totalRows += rows.length;
          processed += 1;
          if (rows.length > 0) {
            await supabase
              .from("stock_price_missing")
              .update({ status: "done" })
              .eq("stock_id", miss.stock_id)
              .eq("trade_date", miss.trade_date);
          } else {
            await supabase
              .from("stock_price_missing")
              .update({ status: "pending" })
              .eq("stock_id", miss.stock_id)
              .eq("trade_date", miss.trade_date);
          }
          summary.push({
            type: "date",
            stock_id: miss.stock_id,
            trade_date: miss.trade_date,
            rows: rows.length,
          });
        } catch (error) {
          const message = error.message;
          if (/402|403|429|Payment Required|rate limit|quota/i.test(message)) {
            rateLimited = true;
          }
          await supabase
            .from("stock_price_missing")
            .update({ status: "failed" })
            .eq("stock_id", miss.stock_id)
            .eq("trade_date", miss.trade_date);
          summary.push({
            type: "date",
            stock_id: miss.stock_id,
            trade_date: miss.trade_date,
            rows: 0,
            error: message,
          });
        }
        if (sleepMs > 0) {
          await sleep(sleepMs);
        }
      }
    }

    res.status(200).json({
      status: rateLimited ? "rate_limited" : "ok",
      dataset,
      processed,
      totalRows,
      summary,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
