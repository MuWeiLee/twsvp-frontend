import { createClient } from "@supabase/supabase-js";

const MARKET_MAP = new Map([
  ["上市", "上市"],
  ["上櫃", "上櫃"],
  ["上柜", "上櫃"],
  ["興櫃", "興櫃"],
  ["兴柜", "興櫃"],
  ["twse", "上市"],
  ["tpex", "上櫃"],
  ["emerging", "興櫃"],
]);

const normalizeMarket = (value) => {
  if (!value) return null;
  const key = `${value}`.trim().toLowerCase();
  return MARKET_MAP.get(key) || MARKET_MAP.get(value) || null;
};

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const buildRow = (item) => {
  const stockId = `${item.stock_id || item.stockId || item.stock_code || item.symbol || ""}`.trim();
  const name = `${item.stock_name || item.name || item.stock_name_full || ""}`.trim();
  const marketRaw = item.type || item.market || item.listing_type;
  const market = normalizeMarket(marketRaw);
  if (!stockId || !name || !market) {
    return null;
  }
  return {
    stock_id: stockId,
    name,
    market,
    industry: item.industry_category || item.industry || null,
    is_active: true,
  };
};

const dedupeRows = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!row?.stock_id) continue;
    const key = `${row.stock_id}`.trim();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, stock_id: key });
      continue;
    }
    const merged = { ...existing };
    if (!merged.name && row.name) merged.name = row.name;
    if (!merged.market && row.market) merged.market = row.market;
    if (!merged.industry && row.industry) merged.industry = row.industry;
    merged.is_active = true;
    map.set(key, merged);
  }
  return Array.from(map.values());
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const {
    FINMIND_TOKEN,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET,
  } = process.env;

  if (CRON_SECRET) {
    const secret = req.headers["x-cron-secret"] || req.query?.secret;
    if (secret !== CRON_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!FINMIND_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing required env vars" });
    return;
  }

  try {
    const finmindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&token=${FINMIND_TOKEN}`;
    const response = await fetch(finmindUrl);
    if (!response.ok) {
      res.status(502).json({ error: "FinMind request failed" });
      return;
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.data)) {
      res.status(502).json({ error: "FinMind response invalid" });
      return;
    }

    const rawRows = payload.data
      .map(buildRow)
      .filter((row) => row && row.stock_id && row.name && row.market);
    const rows = dedupeRows(rawRows);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const chunks = chunkArray(rows, 500);
    let upserted = 0;
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      const { error } = await supabase.from("stocks").upsert(chunk, {
        onConflict: "stock_id",
      });
      if (error) {
        res.status(500).json({ error: "Supabase upsert failed", detail: error.message });
        return;
      }
      upserted += chunk.length;
    }

    res.status(200).json({
      status: "ok",
      total: rows.length,
      upserted,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
