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

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

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

const getDefaultStartDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return formatDate(date);
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const raw = `${value}`.replace(/,/g, "").trim();
  if (!raw || raw === "--" || raw === "-") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  if (text.trim().startsWith("<")) {
    return null;
  }
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

const parseTwseRows = (rows, fields, tradeDate) => {
  const idxCode = findFieldIndex(fields, ["證券代號"]);
  const idxName = findFieldIndex(fields, ["證券名稱"]);
  const idxVolume = findFieldIndex(fields, ["成交股數"]);
  const idxTurnover = findFieldIndex(fields, ["成交金額"]);
  const idxOpen = findFieldIndex(fields, ["開盤價", "開盤"]);
  const idxHigh = findFieldIndex(fields, ["最高價", "最高"]);
  const idxLow = findFieldIndex(fields, ["最低價", "最低"]);
  const idxClose = findFieldIndex(fields, ["收盤價", "收盤"]);

  return rows
    .map((row) => {
      const stockId = `${row[idxCode] || ""}`.trim();
      const name = `${row[idxName] || ""}`.trim();
      if (!stockId || !name) return null;
      const volume = normalizeNumber(row[idxVolume]);
      const turnover = normalizeNumber(row[idxTurnover]);
      let average = null;
      if (volume && turnover) {
        average = Number((turnover / volume).toFixed(4));
      }
      return {
        stock: {
          stock_id: stockId,
          name,
          market: "上市",
          industry: null,
          is_active: true,
        },
        price: {
          stock_id: stockId,
          trade_date: tradeDate,
          open: normalizeNumber(row[idxOpen]),
          high: normalizeNumber(row[idxHigh]),
          low: normalizeNumber(row[idxLow]),
          close: normalizeNumber(row[idxClose]),
          average,
          volume: volume === null ? null : Math.trunc(volume),
          turnover,
        },
      };
    })
    .filter(Boolean);
};

const parseTpexRows = (rows, fields, tradeDate) => {
  let idxCode = findFieldIndex(fields, ["證券代號", "股票代號"]);
  let idxName = findFieldIndex(fields, ["證券名稱", "名稱"]);
  let idxClose = findFieldIndex(fields, ["收盤"]);
  let idxOpen = findFieldIndex(fields, ["開盤"]);
  let idxHigh = findFieldIndex(fields, ["最高"]);
  let idxLow = findFieldIndex(fields, ["最低"]);
  let idxVolume = findFieldIndex(fields, ["成交股數", "成交量"]);
  let idxTurnover = findFieldIndex(fields, ["成交金額", "成交值"]);

  if (idxCode < 0) {
    idxCode = 0;
    idxName = 1;
    idxClose = 2;
    idxOpen = 4;
    idxHigh = 5;
    idxLow = 6;
    idxVolume = 7;
    idxTurnover = 8;
  }

  return rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const stockId = `${row[idxCode] || ""}`.trim();
      const name = `${row[idxName] || ""}`.trim();
      if (!stockId || !name) return null;
      const volume = normalizeNumber(row[idxVolume]);
      const turnover = normalizeNumber(row[idxTurnover]);
      let average = null;
      if (volume && turnover) {
        average = Number((turnover / volume).toFixed(4));
      }
      return {
        stock: {
          stock_id: stockId,
          name,
          market: "上櫃",
          industry: null,
          is_active: true,
        },
        price: {
          stock_id: stockId,
          trade_date: tradeDate,
          open: normalizeNumber(row[idxOpen]),
          high: normalizeNumber(row[idxHigh]),
          low: normalizeNumber(row[idxLow]),
          close: normalizeNumber(row[idxClose]),
          average,
          volume: volume === null ? null : Math.trunc(volume),
          turnover,
        },
      };
    })
    .filter(Boolean);
};

const upsertRows = async (supabase, table, rows, chunkSize, onConflict) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
};

const getDateRange = (start, end) => {
  const dates = [];
  const cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const run = async () => {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const startDate = process.env.START_DATE || getDefaultStartDate();
  const endDate = process.env.END_DATE || formatDate(new Date());
  const chunkSize = Number(process.env.CHUNK_SIZE || 500);
  const sleepMs = Number(process.env.SLEEP_MS || 250);
  const dryRun = process.env.DRY_RUN === "1";

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const dates = getDateRange(startDate, endDate);
  let totalRows = 0;
  for (const date of dates) {
    const tradeDate = formatDate(date);
    let twseRows = [];
    let tpexRows = [];
    try {
      const twse = await fetchTwseDaily(date);
      twseRows = parseTwseRows(twse.rows, twse.fields, tradeDate);
    } catch (error) {
      console.warn(`TWSE ${tradeDate} failed: ${error.message}`);
    }
    try {
      const tpex = await fetchTpexDaily(date);
      tpexRows = parseTpexRows(tpex.rows, tpex.fields, tradeDate);
    } catch (error) {
      console.warn(`TPEx ${tradeDate} failed: ${error.message}`);
    }

    const combined = [...twseRows, ...tpexRows];
    if (!combined.length) {
      continue;
    }

    const stockRows = combined.map((row) => row.stock);
    const priceRows = combined.map((row) => row.price);
    totalRows += priceRows.length;

    if (!dryRun) {
      await upsertRows(supabase, "stocks", stockRows, chunkSize, "stock_id");
      await upsertRows(
        supabase,
        "stock_prices",
        priceRows,
        chunkSize,
        "stock_id,trade_date"
      );
    }

    process.stdout.write(`Synced ${tradeDate} (${priceRows.length} rows)\n`);
    if (sleepMs > 0) {
      await sleep(sleepMs);
    }
  }

  process.stdout.write(`Done. Total rows: ${totalRows}\n`);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
