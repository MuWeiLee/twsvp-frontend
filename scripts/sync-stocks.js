import { createClient } from "@supabase/supabase-js";

const TWSE_ENDPOINT =
  process.env.TWSE_ENDPOINT || "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL";
const TPEX_ENDPOINT =
  process.env.TPEX_ENDPOINT ||
  "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const pad2 = (value) => `${value}`.padStart(2, "0");

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

const fetchTwseDaily = async (date) => {
  const url = new URL(TWSE_ENDPOINT);
  url.searchParams.set("response", "json");
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
  if (!payload || payload.stat !== "OK" || !Array.isArray(payload.data)) {
    return { rows: [], fields: [] };
  }
  return {
    rows: payload.data,
    fields: payload.fields || [],
  };
};

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
    const rows = payload.aaData || payload.data || payload.table || [];
    const fields = payload.fields || payload.field || payload.title || [];
    return { rows, fields };
  };

  const padded = await attempt(true);
  if (padded && padded.rows?.length) return padded;
  const unpadded = await attempt(false);
  return unpadded || { rows: [], fields: [] };
};

const findFieldIndex = (fields, candidates) => {
  if (!Array.isArray(fields)) return -1;
  return fields.findIndex((field) =>
    candidates.some((candidate) => `${field}`.includes(candidate))
  );
};

const parseTwseStocks = (rows, fields) => {
  const idxCode = findFieldIndex(fields, ["證券代號"]);
  const idxName = findFieldIndex(fields, ["證券名稱"]);
  return rows
    .map((row) => {
      const stockId = `${row[idxCode] || ""}`.trim();
      const name = `${row[idxName] || ""}`.trim();
      if (!stockId || !name) return null;
      return {
        stock_id: stockId,
        name,
        market: "上市",
        industry: null,
        is_active: true,
      };
    })
    .filter(Boolean);
};

const parseTpexStocks = (rows, fields) => {
  let idxCode = findFieldIndex(fields, ["證券代號", "股票代號"]);
  let idxName = findFieldIndex(fields, ["證券名稱", "名稱"]);
  if (idxCode < 0) {
    idxCode = 0;
    idxName = 1;
  }
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const stockId = `${row[idxCode] || ""}`.trim();
      const name = `${row[idxName] || ""}`.trim();
      if (!stockId || !name) return null;
      return {
        stock_id: stockId,
        name,
        market: "上櫃",
        industry: null,
        is_active: true,
      };
    })
    .filter(Boolean);
};

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const run = async () => {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const maxLookback = Number(process.env.MAX_LOOKBACK_DAYS || 7);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  let allStocks = [];
  const cursor = new Date();
  for (let i = 0; i <= maxLookback; i += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() - i);
    let twseRows = [];
    let tpexRows = [];
    try {
      const twse = await fetchTwseDaily(date);
      twseRows = parseTwseStocks(twse.rows, twse.fields);
    } catch (error) {
      console.warn(`TWSE failed: ${error.message}`);
    }
    try {
      const tpex = await fetchTpexDaily(date);
      tpexRows = parseTpexStocks(tpex.rows, tpex.fields);
    } catch (error) {
      console.warn(`TPEx failed: ${error.message}`);
    }
    allStocks = [...twseRows, ...tpexRows];
    if (allStocks.length) break;
  }

  if (!allStocks.length) {
    throw new Error("No stock rows fetched from TWSE/TPEx.");
  }

  const chunks = chunkArray(allStocks, 500);
  let upserted = 0;
  for (const chunk of chunks) {
    const { error } = await supabase.from("stocks").upsert(chunk, {
      onConflict: "stock_id",
    });
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
    upserted += chunk.length;
  }

  console.log(`Synced ${upserted} stocks.`);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
