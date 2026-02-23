import { createClient } from "@supabase/supabase-js";
import {
  getDateRange,
  getDefaultStartDate,
  getTaipeiDateString,
  requiredEnv,
  sleep,
} from "./lib/stock-sync.js";
import {
  fetchFinmindPrices,
  filterRowsByCalendar,
  parseFinmindRows,
} from "./lib/finmind.js";

const upsertRows = async (supabase, table, rows, chunkSize, onConflict) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
};

const fetchStockIds = async (supabase, offset, limit, includeInactive) => {
  let query = supabase
    .from("stocks")
    .select("stock_id")
    .order("stock_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase stocks query failed: ${error.message}`);
  }
  return (data || []).map((row) => `${row.stock_id}`.trim()).filter(Boolean);
};

const fetchTradingCalendarDates = async (supabase, startDate, endDate) => {
  const { data, error } = await supabase
    .from("trading_calendar")
    .select("trade_date")
    .gte("trade_date", startDate)
    .lte("trade_date", endDate)
    .order("trade_date", { ascending: true });
  if (error) {
    throw new Error(`Supabase trading_calendar query failed: ${error.message}`);
  }
  return (data || []).map((row) => row.trade_date);
};

const run = async () => {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const finmindToken = requiredEnv("FINMIND_TOKEN");
  const startDate = process.env.START_DATE || getDefaultStartDate();
  const endDate = process.env.END_DATE || getTaipeiDateString();
  const chunkSize = Number(process.env.CHUNK_SIZE || 500);
  const sleepMs = Number(process.env.SLEEP_MS || 250);
  const dataset = process.env.FINMIND_DATASET || "TaiwanStockPrice";
  const stockOffset = Number(process.env.STOCK_OFFSET || 0);
  const maxStocks = Number(process.env.MAX_STOCKS || 5000);
  const includeInactive = process.env.INCLUDE_INACTIVE === "1";
  const dryRun = process.env.DRY_RUN === "1";

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const dates = getDateRange(startDate, endDate);
  const calendarDates = await fetchTradingCalendarDates(supabase, startDate, endDate);
  if (!calendarDates.length) {
    throw new Error("No trading dates found in trading_calendar for the range.");
  }
  const calendarSet = new Set(calendarDates);
  let totalRows = 0;
  const stockIds = await fetchStockIds(
    supabase,
    stockOffset,
    maxStocks,
    includeInactive
  );
  if (!stockIds.length) {
    throw new Error("No stock ids found for sync.");
  }
  for (const stockId of stockIds) {
    let rows = [];
    try {
      const raw = await fetchFinmindPrices(
        finmindToken,
        dataset,
        stockId,
        startDate,
        endDate
      );
      rows = filterRowsByCalendar(parseFinmindRows(raw, stockId), calendarSet);
      if (!dryRun && rows.length) {
        await upsertRows(
          supabase,
          "stock_prices",
          rows,
          chunkSize,
          "stock_id,trade_date"
        );
      }
      totalRows += rows.length;
    } catch (error) {
      console.warn(`FinMind ${stockId} failed: ${error.message}`);
    }
    process.stdout.write(
      `Synced ${stockId} (${rows.length} rows, ${dates.length} days)\n`
    );
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
