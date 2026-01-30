import { supabase } from "./supabase.js";

const DEFAULT_STOCK_START_DATE = "2025-01-01";

const normalizeStartDate = (value) => {
  if (!value) return DEFAULT_STOCK_START_DATE;
  const normalized = String(value).trim().replace(/\//g, "-");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return DEFAULT_STOCK_START_DATE;
  return parsed.toISOString().slice(0, 10);
};

const getStockStartDate = () =>
  normalizeStartDate(
    import.meta.env.VITE_STOCK_START_DATE || import.meta.env.VITE_START_DATE
  );

const normalizePagination = (page = 1, pageSize = 20) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Number(pageSize) || 20);
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to };
};

export const searchStocksSupabase = async (query, limitOrOptions = {}) => {
  const q = query.trim();
  if (!q) return [];
  let page = 1;
  let pageSize = 20;
  if (typeof limitOrOptions === "number") {
    pageSize = limitOrOptions;
  } else if (limitOrOptions && typeof limitOrOptions === "object") {
    page = limitOrOptions.page ?? page;
    pageSize = limitOrOptions.pageSize ?? pageSize;
  }
  const { from, to } = normalizePagination(page, pageSize);
  const { data, error } = await supabase
    .from("stocks")
    .select("stock_id,name,market")
    .or(`stock_id.ilike.%${q}%,name.ilike.%${q}%`)
    .order("stock_id", { ascending: true })
    .range(from, to);

  if (error) {
    return [];
  }

  return data || [];
};

export const fetchStockByIdSupabase = async (stockId) => {
  const id = String(stockId || "").trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("stocks")
    .select("stock_id,name,market")
    .eq("stock_id", id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
};

export const fetchStockPricesSupabase = async (
  stockId,
  { startDate, endDate, limit } = {}
) => {
  const id = String(stockId || "").trim();
  if (!id) return [];
  const resolvedStartDate = normalizeStartDate(startDate || getStockStartDate());
  let query = supabase
    .from("stock_prices")
    .select("trade_date,open,high,low,close,average,volume,turnover")
    .eq("stock_id", id)
    .order("trade_date", { ascending: true })
    .gte("trade_date", resolvedStartDate);
  if (endDate) {
    query = query.lte("trade_date", normalizeStartDate(endDate));
  }
  if (limit) {
    query = query.limit(limit);
  }
  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data || [];
};
