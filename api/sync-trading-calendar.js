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

const fetchTradingDates = async (token) => {
  const url = new URL(FINMIND_ENDPOINT);
  url.searchParams.set("dataset", "TaiwanStockTradingDate");
  url.searchParams.set("token", token);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FinMind request failed ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (payload?.status && payload.status !== 200) {
    throw new Error(`FinMind response status ${payload.status} ${payload.msg || ""}`.trim());
  }
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("FinMind response invalid");
  }
  return payload.data
    .map((row) => row.date || row.trade_date)
    .filter(Boolean);
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
    const token = requiredEnv("FINMIND_TOKEN");
    const minDate = `${params.min_date || params.minDate || ""}`.trim();

    const dates = await fetchTradingDates(token);
    const filtered = minDate ? dates.filter((d) => d >= minDate) : dates;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const rows = filtered.map((tradeDate) => ({ trade_date: tradeDate }));
    const chunks = chunkArray(rows, 1000);
    let upserted = 0;
    for (const chunk of chunks) {
      const { error } = await supabase.from("trading_calendar").upsert(chunk, {
        onConflict: "trade_date",
      });
      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
      upserted += chunk.length;
    }

    res.status(200).json({ status: "ok", total: rows.length, upserted });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
