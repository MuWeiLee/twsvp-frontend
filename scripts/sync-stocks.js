import { createClient } from "@supabase/supabase-js";
import {
  chunkArray,
  fetchTpexDaily,
  fetchTwseDaily,
  findFieldIndex,
  requiredEnv,
} from "./lib/stock-sync.js";

const TWSE_ENDPOINT =
  process.env.TWSE_ENDPOINT || "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL";
const TPEX_ENDPOINT =
  process.env.TPEX_ENDPOINT ||
  "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php";

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
      const twse = await fetchTwseDaily(TWSE_ENDPOINT, date);
      twseRows = parseTwseStocks(twse.rows, twse.fields);
    } catch (error) {
      console.warn(`TWSE failed: ${error.message}`);
    }
    try {
      const tpex = await fetchTpexDaily(TPEX_ENDPOINT, date);
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
