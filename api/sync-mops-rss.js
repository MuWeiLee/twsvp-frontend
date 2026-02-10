import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";
import crypto from "crypto";

const RSS_URL =
  process.env.MOPS_RSS_URL || "https://mopsov.twse.com.tw/nas/rss/mopsrss201001.xml";

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

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const stripHtml = (value) => {
  if (!value) return "";
  return `${value}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};

const normalizeText = (value) => {
  if (!value) return null;
  const text = `${value}`.trim();
  return text ? text : null;
};

const hashId = (value) => {
  if (!value) return null;
  return crypto.createHash("sha1").update(value).digest("hex");
};

const getCharset = (contentType = "") => {
  const match = `${contentType}`.match(/charset=([^;]+)/i);
  if (!match) return "";
  return match[1].trim().toLowerCase();
};

const decodeResponse = async (response) => {
  const contentType = response.headers?.get?.("content-type") || "";
  const charset = getCharset(contentType);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (charset.includes("big5") || charset.includes("ms950") || charset.includes("cp950")) {
    return iconv.decode(buffer, "big5");
  }
  return buffer.toString("utf8");
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
    const dryRun = `${params.dry_run || ""}` === "1";
    const limit = Number(params.limit || 200);

    const response = await fetch(RSS_URL, {
      headers: {
        "User-Agent": "twsvp-rss-sync/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "RSS fetch failed" });
      return;
    }

    const xml = await decodeResponse(response);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      trimValues: false,
    });
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item || [];
    const list = Array.isArray(items) ? items : [items];

    const rows = list
      .filter(Boolean)
      .slice(0, Number.isFinite(limit) ? limit : 200)
      .map((item) => {
        const title = normalizeText(item.title);
        const link = normalizeText(item.link);
        const guid = normalizeText(item.guid?.["#text"] || item.guid);
        const description = normalizeText(stripHtml(item.description));
        const pubDate = parseDate(item.pubDate);
        const idSource = guid || link || `${title || ""}-${pubDate || ""}`;
        const articleId = hashId(idSource);
        if (!articleId) return null;
        return {
          article_id: articleId,
          title: title || null,
          link: link || null,
          description: description || null,
          content: null,
          pub_date: pubDate,
          pub_date_tz: null,
          creator: null,
          keywords: null,
          video_url: null,
          image_url: null,
          source_id: "mops",
          source_url: "https://mopsov.twse.com.tw/",
          source_icon: null,
          source_priority: null,
          country: ["tw"],
          category: ["finance"],
          language: "zh",
          ai_tag: null,
          sentiment: null,
          sentiment_stats: null,
          ai_region: null,
          ai_org: null,
          duplicate: null,
          datatype: "rss",
          raw: item,
        };
      })
      .filter(Boolean);

    if (!dryRun && rows.length) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { error } = await supabase
        .from("news_articles")
        .upsert(rows, { onConflict: "article_id" });
      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
    }

    res.status(200).json({
      status: "ok",
      saved: rows.length,
      dryRun,
      source: RSS_URL,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
