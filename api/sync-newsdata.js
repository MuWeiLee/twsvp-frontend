import { createClient } from "@supabase/supabase-js";

const NEWSDATA_ENDPOINT =
  process.env.NEWSDATA_BASE_URL || "https://newsdata.io/api/1/latest";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return value ? [value] : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const chunkRows = (rows, size) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
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

  let supabase = null;
  try {
    const params = parseParams(req);
    const apiKey = requiredEnv("NEWSDATA_API_KEY");
    const q = params.q || process.env.NEWSDATA_Q || "";
    const qInTitle = params.q_in_title || params.qInTitle || process.env.NEWSDATA_Q_IN_TITLE;
    const qInMeta = params.q_in_meta || params.qInMeta || process.env.NEWSDATA_Q_IN_META;
    const country = params.country || process.env.NEWSDATA_COUNTRY || "";
    const language = params.language || process.env.NEWSDATA_LANGUAGE || "";
    const category = params.category || process.env.NEWSDATA_CATEGORY || "";
    const domain = params.domain || process.env.NEWSDATA_DOMAIN || "";
    const timeframe = params.timeframe || process.env.NEWSDATA_TIMEFRAME || "";
    const size = params.size || process.env.NEWSDATA_SIZE || "";
    const fullContent = params.full_content || process.env.NEWSDATA_FULL_CONTENT || "";
    const page = params.page || params.next_page || process.env.NEWSDATA_PAGE || "";
    const dryRun = `${params.dry_run || ""}` === "1";
    const chunkSize = Number(params.chunk_size || process.env.NEWSDATA_CHUNK_SIZE || 200);

    const url = new URL(NEWSDATA_ENDPOINT);
    url.searchParams.set("apikey", apiKey);
    if (q) url.searchParams.set("q", q);
    if (qInTitle) url.searchParams.set("qInTitle", qInTitle);
    if (qInMeta) url.searchParams.set("qInMeta", qInMeta);
    if (country) url.searchParams.set("country", country);
    if (language) url.searchParams.set("language", language);
    if (category) url.searchParams.set("category", category);
    if (domain) url.searchParams.set("domain", domain);
    if (timeframe) url.searchParams.set("timeframe", timeframe);
    if (size) url.searchParams.set("size", size);
    if (fullContent) url.searchParams.set("full_content", fullContent);
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url);
    if (!response.ok) {
      let detail = null;
      try {
        detail = await response.json();
      } catch (error) {
        detail = await response.text();
      }
      const safeUrl = new URL(url);
      safeUrl.searchParams.set("apikey", "***");
      console.error("NewsData request failed:", {
        status: response.status,
        detail,
        url: safeUrl.toString(),
      });
      res.status(response.status).json({
        error: "NewsData request failed",
        detail,
      });
      return;
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];

    const rows = results
      .filter((item) => item && item.article_id)
      .map((item) => ({
        article_id: item.article_id,
        title: item.title || null,
        link: item.link || null,
        description: item.description || null,
        content: item.content || null,
        pub_date: parseDate(item.pubDate),
        pub_date_tz: item.pubDateTZ || null,
        creator: normalizeArray(item.creator),
        keywords: normalizeArray(item.keywords),
        video_url: item.video_url || null,
        image_url: item.image_url || null,
        source_id: item.source_id || null,
        source_url: item.source_url || null,
        source_icon: item.source_icon || null,
        source_priority: item.source_priority ?? null,
        country: normalizeArray(item.country),
        category: normalizeArray(item.category),
        language: item.language || null,
        ai_tag: item.ai_tag || null,
        sentiment: item.sentiment || null,
        sentiment_stats: item.sentiment_stats || null,
        ai_region: normalizeArray(item.ai_region),
        ai_org: normalizeArray(item.ai_org),
        duplicate: item.duplicate ?? null,
        datatype: item.datatype || null,
        raw: item,
      }));

    if (!dryRun && rows.length) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const chunks = chunkRows(rows, chunkSize);
      for (const chunk of chunks) {
        const { error } = await supabase
          .from("news_articles")
          .upsert(chunk, { onConflict: "article_id" });
        if (error) {
          throw new Error(`Supabase upsert failed: ${error.message}`);
        }
      }
    }

    res.status(200).json({
      status: "ok",
      totalResults: payload?.totalResults ?? rows.length,
      nextPage: payload?.nextPage ?? null,
      saved: rows.length,
      dryRun,
      params: {
        q,
        qInTitle,
        qInMeta,
        country,
        language,
        category,
        domain,
        timeframe,
        size,
        fullContent,
        page,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
