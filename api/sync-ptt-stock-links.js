import { createClient } from "@supabase/supabase-js";

const DEFAULT_SINCE_HOURS = 24;
const DEFAULT_MIN_NET_PUSH = 20;
const DEFAULT_ARTICLE_LIMIT = 1200;

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

const normalizeTitle = (value) => `${value || ""}`.replace(/\s+/g, "");

const escapeRegExp = (value) => `${value}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const chunkRows = (rows, size = 200) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const createRun = async (supabase) => {
  const { data, error } = await supabase
    .from("ptt_sync_runs")
    .insert({
      stage: "link",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("run_id")
    .single();
  if (error) throw new Error(`Supabase run insert failed: ${error.message}`);
  return data?.run_id || null;
};

const finishRun = async (supabase, runId, payload) => {
  if (!runId) return;
  const { error } = await supabase
    .from("ptt_sync_runs")
    .update({
      ...payload,
      finished_at: new Date().toISOString(),
    })
    .eq("run_id", runId);
  if (error) {
    console.error("Failed to update ptt_sync_runs:", error.message);
  }
};

const loadActiveStocks = async (supabase, { batchSize = 1000 } = {}) => {
  const safeBatchSize = Math.max(100, Math.min(5000, Number(batchSize) || 1000));
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + safeBatchSize - 1;
    const { data, error } = await supabase
      .from("stocks")
      .select("stock_id,name,is_active")
      .eq("is_active", true)
      .order("stock_id", { ascending: true })
      .range(from, to);
    if (error) {
      throw new Error(`Supabase stocks query failed: ${error.message}`);
    }
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < safeBatchSize) break;
    from += safeBatchSize;
  }
  return rows;
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let runId = null;
  try {
    const params = parseParams(req);
    const sinceHours = safeNumber(
      params.since_hours || params.sinceHours,
      DEFAULT_SINCE_HOURS,
      { min: 1, max: 72 }
    );
    const minNetPush = safeNumber(
      params.min_net_push || params.minNetPush,
      DEFAULT_MIN_NET_PUSH,
      { min: -100, max: 1000 }
    );
    const articleLimit = safeNumber(
      params.article_limit || params.articleLimit,
      DEFAULT_ARTICLE_LIMIT,
      { min: 1, max: 5000 }
    );
    const dryRun = `${params.dry_run || ""}` === "1";
    const titleOnly = `${params.title_only ?? "1"}` !== "0";

    runId = await createRun(supabase);

    const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    const { data: articles, error: articleError } = await supabase
      .from("ptt_articles")
      .select("board,article_id,title,published_at,net_push")
      .eq("board", "Stock")
      .gte("published_at", sinceIso)
      .gte("net_push", minNetPush)
      .not("content", "is", null)
      .neq("content", "")
      .order("published_at", { ascending: false })
      .limit(articleLimit);
    if (articleError) {
      throw new Error(`Supabase articles query failed: ${articleError.message}`);
    }

    const stocks = await loadActiveStocks(supabase, { batchSize: 2000 });
    const stockIdMap = new Map(stocks.map((row) => [`${row.stock_id}`, row]));
    const stockNames = stocks
      .map((row) => ({
        stock_id: `${row.stock_id}`,
        name: `${row.name || ""}`,
        normalizedName: normalizeTitle(row.name || ""),
      }))
      .filter((row) => row.normalizedName.length >= 2);

    const links = [];
    const dedup = new Set();
    for (const article of articles || []) {
      if (!article?.article_id || article?.board !== "Stock") continue;
      const title = `${article.title || ""}`;
      const normalizedTitle = normalizeTitle(title);
      if (!normalizedTitle) continue;

      const codeMatches = title.match(/(?<!\d)\d{4}(?!\d)/g) || [];
      for (const code of codeMatches) {
        const stock = stockIdMap.get(code);
        if (!stock) continue;
        const key = `Stock|${article.article_id}|${code}|title_stock_id`;
        if (dedup.has(key)) continue;
        dedup.add(key);
        links.push({
          board: "Stock",
          article_id: article.article_id,
          stock_id: code,
          matched_text: code,
          match_method: "title_stock_id",
        });
      }

      if (titleOnly) {
        for (const stock of stockNames) {
          if (!stock.normalizedName) continue;
          if (!normalizedTitle.includes(stock.normalizedName)) continue;
          const key = `Stock|${article.article_id}|${stock.stock_id}|title_stock_name`;
          if (dedup.has(key)) continue;
          dedup.add(key);
          links.push({
            board: "Stock",
            article_id: article.article_id,
            stock_id: stock.stock_id,
            matched_text: stock.name,
            match_method: "title_stock_name",
          });
        }
      }
    }

    let linked = 0;
    if (!dryRun && links.length) {
      const chunks = chunkRows(links, 300);
      for (const chunk of chunks) {
        const { error } = await supabase.from("ptt_stock_links").upsert(chunk, {
          onConflict: "board,article_id,stock_id,match_method",
        });
        if (error) {
          throw new Error(`Supabase link upsert failed: ${error.message}`);
        }
        linked += chunk.length;
      }
    }

    await finishRun(supabase, runId, {
      status: "ok",
      scanned: (articles || []).length,
      qualified: (articles || []).length,
      saved: 0,
      linked: dryRun ? 0 : linked,
      error_message: null,
    });

    res.status(200).json({
      status: "ok",
      run_id: runId,
      since_hours: sinceHours,
      min_net_push: minNetPush,
      scanned_articles: (articles || []).length,
      matched_links: links.length,
      linked: dryRun ? 0 : linked,
      dryRun,
      title_only: titleOnly,
    });
  } catch (error) {
    await finishRun(supabase, runId, {
      status: "failed",
      scanned: 0,
      qualified: 0,
      saved: 0,
      linked: 0,
      error_message: error.message,
    });
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
