import { createClient } from "@supabase/supabase-js";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
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

const normalizeText = (value) => {
  if (!value) return "";
  return `${value}`.replace(/\s+/g, "");
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    const sinceHours = Number(params.since_hours || params.sinceHours || 24);
    const newsLimit = Number(params.news_limit || params.newsLimit || 200);
    const dryRun = `${params.dry_run || ""}` === "1";
    const minNameMatches = Number(params.min_name_matches || params.minNameMatches || 1);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: stocks, error: stockError } = await supabase
      .from("stocks")
      .select("stock_id,name,is_active")
      .eq("is_active", true);
    if (stockError) {
      throw new Error(`Supabase stocks query failed: ${stockError.message}`);
    }

    const activeStocks = (stocks || []).filter((row) => row?.stock_id && row?.name);
    if (!activeStocks.length) {
      res.status(200).json({ status: "ok", matched: 0, saved: 0, reason: "no stocks" });
      return;
    }

    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - sinceHours);
    const sinceIso = sinceDate.toISOString();

    const { data: articles, error: newsError } = await supabase
      .from("news_articles")
      .select("article_id,title,description,content,pub_date")
      .gte("pub_date", sinceIso)
      .order("pub_date", { ascending: false })
      .limit(newsLimit);
    if (newsError) {
      throw new Error(`Supabase news query failed: ${newsError.message}`);
    }

    const stockMatches = [];
    for (const article of articles || []) {
      if (!article?.article_id) continue;
      const rawDescription = `${article.description || ""}`;
      const descriptionText = normalizeText(rawDescription);
      const nameMatches = new Set();
      if (!descriptionText) continue;
      for (const stock of activeStocks) {
        const name = normalizeText(stock.name);
        const stockId = `${stock.stock_id}`.trim();
        if (!stockId) continue;

        if (!name) continue;
        const namePattern = new RegExp(escapeRegExp(name), "g");
        const count = (descriptionText.match(namePattern) || []).length;
        if (count >= minNameMatches && !nameMatches.has(stockId)) {
          stockMatches.push({
            article_id: article.article_id,
            stock_id: stockId,
            matched_text: stock.name,
            match_method: "desc_name",
          });
          nameMatches.add(stockId);
        }
      }
    }

    let saved = 0;
    if (!dryRun && stockMatches.length) {
      const { error } = await supabase
        .from("news_stock_links")
        .upsert(stockMatches, {
          onConflict: "article_id,stock_id,match_method",
        });
      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
      saved = stockMatches.length;
    }

    res.status(200).json({
      status: "ok",
      matched: stockMatches.length,
      saved,
      dryRun,
      params: {
        sinceHours,
        newsLimit,
        minNameMatches,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
