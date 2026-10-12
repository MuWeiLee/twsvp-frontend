import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { syncOneStock } from "./sync-ptt-hot.js";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_SINCE_HOURS = 24;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_MAX_ARTICLES = 30;
const DEFAULT_MIN_NET_PUSH = 20;
const STATE_KEY = "default";

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

const safeNumber = (value, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const isTrue = (value) => `${value || ""}` === "1" || `${value || ""}`.toLowerCase() === "true";

const upsertState = async (supabase, payload) => {
  const { error } = await supabase.from("ptt_hot_sync_state").upsert(
    {
      state_key: STATE_KEY,
      ...payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "state_key" }
  );
  if (error) {
    throw new Error(`Supabase upsert state failed: ${error.message}`);
  }
};

const getState = async (supabase) => {
  const { data, error } = await supabase
    .from("ptt_hot_sync_state")
    .select("*")
    .eq("state_key", STATE_KEY)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase state query failed: ${error.message}`);
  }
  return data || null;
};

const countStocks = async (supabase, includeInactive = false) => {
  let query = supabase.from("stocks").select("stock_id", { count: "exact", head: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`Supabase stocks count failed: ${error.message}`);
  }
  return count || 0;
};

const fetchStocksBatch = async (supabase, offset, limit, includeInactive = false) => {
  let query = supabase
    .from("stocks")
    .select("stock_id,name,is_active")
    .order("stock_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase stocks query failed: ${error.message}`);
  }
  return data || [];
};

const insertLogs = async (supabase, rows) => {
  if (!rows.length) return;
  const { error } = await supabase.from("ptt_hot_sync_logs").insert(rows);
  if (error) {
    throw new Error(`Supabase insert logs failed: ${error.message}`);
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

  try {
    const params = parseParams(req);
    const batchSize = safeNumber(params.batch_size || params.batchSize, DEFAULT_BATCH_SIZE, {
      min: 1,
      max: 100,
    });
    const sinceHours = safeNumber(
      params.since_hours || params.sinceHours,
      DEFAULT_SINCE_HOURS,
      { min: 1, max: 72 }
    );
    const maxPages = safeNumber(params.max_pages || params.maxPages, DEFAULT_MAX_PAGES, {
      min: 1,
      max: 20,
    });
    const maxArticles = safeNumber(
      params.max_articles || params.maxArticles,
      DEFAULT_MAX_ARTICLES,
      { min: 1, max: 100 }
    );
    const minNetPush = safeNumber(
      params.min_net_push || params.minNetPush,
      DEFAULT_MIN_NET_PUSH,
      { min: -100, max: 1000 }
    );
    const includeInactive = isTrue(params.include_inactive || params.includeInactive || "0");
    const dryRun = isTrue(params.dry_run || params.dryRun || "0");
    const reset = isTrue(params.reset || "0");
    const requireContent = `${params.require_content ?? "1"}` !== "0";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const totalStocks = await countStocks(supabase, includeInactive);
    if (totalStocks <= 0) {
      await upsertState(supabase, {
        stock_offset: 0,
        total_stocks: 0,
        status: "idle",
        last_batch_size: 0,
        last_error: null,
        last_run_started_at: new Date().toISOString(),
        last_run_finished_at: new Date().toISOString(),
      });
      res.status(200).json({ status: "ok", reason: "no stocks", processed: 0, total_stocks: 0 });
      return;
    }

    if (reset) {
      await upsertState(supabase, {
        stock_offset: 0,
        total_stocks: totalStocks,
        status: "idle",
        last_batch_size: 0,
        last_error: null,
      });
    }

    const state = await getState(supabase);
    let startOffset = safeNumber(params.stock_offset || params.stockOffset, state?.stock_offset || 0, {
      min: 0,
      max: Math.max(0, totalStocks - 1),
    });
    if (startOffset >= totalStocks) startOffset = 0;

    let stocks = await fetchStocksBatch(supabase, startOffset, batchSize, includeInactive);
    if (!stocks.length) {
      startOffset = 0;
      stocks = await fetchStocksBatch(supabase, startOffset, batchSize, includeInactive);
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    await upsertState(supabase, {
      stock_offset: startOffset,
      total_stocks: totalStocks,
      status: "running",
      last_batch_size: stocks.length,
      last_run_started_at: startedAt,
      last_error: null,
    });

    let succeeded = 0;
    let failed = 0;
    let totalQueried = 0;
    let totalSaved = 0;
    let withContent = 0;
    let withoutContent = 0;
    const logs = [];

    for (let i = 0; i < stocks.length; i += 1) {
      const stock = stocks[i];
      const offset = (startOffset + i) % totalStocks;
      const stockStartedAt = new Date().toISOString();
      try {
        const result = await syncOneStock({
          supabase,
          stockIdInput: stock.stock_id,
          stockNameInput: stock.name,
          sinceHours,
          maxPages,
          maxArticles,
          minNetPush,
          dryRun,
          requireContent,
        });

        succeeded += 1;
        totalQueried += result.queried || 0;
        totalSaved += result.saved || 0;
        withContent += result.stats?.with_content || 0;
        withoutContent += result.stats?.without_content || 0;

        logs.push({
          run_id: runId,
          stock_id: stock.stock_id,
          stock_name: stock.name || stock.stock_id,
          stock_offset: offset,
          since_hours: sinceHours,
          min_net_push: minNetPush,
          queried: result.queried || 0,
          saved: result.saved || 0,
          with_content: result.stats?.with_content || 0,
          without_content: result.stats?.without_content || 0,
          page_fetches: result.stats?.page_fetches || 0,
          page_successes: result.stats?.page_successes || 0,
          page_failures: result.stats?.page_failures || 0,
          status: "ok",
          error_message: null,
          dry_run: dryRun,
          started_at: stockStartedAt,
          finished_at: new Date().toISOString(),
        });
      } catch (error) {
        failed += 1;
        logs.push({
          run_id: runId,
          stock_id: stock.stock_id,
          stock_name: stock.name || stock.stock_id,
          stock_offset: offset,
          since_hours: sinceHours,
          min_net_push: minNetPush,
          queried: 0,
          saved: 0,
          with_content: 0,
          without_content: 0,
          page_fetches: 0,
          page_successes: 0,
          page_failures: 0,
          status: "failed",
          error_message: error?.message || "unknown error",
          dry_run: dryRun,
          started_at: stockStartedAt,
          finished_at: new Date().toISOString(),
        });
      }
    }

    await insertLogs(supabase, logs);

    const nextOffset = (startOffset + stocks.length) % totalStocks;
    await upsertState(supabase, {
      stock_offset: nextOffset,
      total_stocks: totalStocks,
      status: failed > 0 ? "partial_failed" : "idle",
      last_batch_size: stocks.length,
      last_error: failed > 0 ? `${failed} stock(s) failed` : null,
      last_run_started_at: startedAt,
      last_run_finished_at: new Date().toISOString(),
    });

    res.status(200).json({
      status: "ok",
      run_id: runId,
      processed: stocks.length,
      succeeded,
      failed,
      total_stocks: totalStocks,
      start_offset: startOffset,
      next_offset: nextOffset,
      since_hours: sinceHours,
      min_net_push: minNetPush,
      require_content: requireContent,
      dryRun,
      totals: {
        queried: totalQueried,
        saved: totalSaved,
        with_content: withContent,
        without_content: withoutContent,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
