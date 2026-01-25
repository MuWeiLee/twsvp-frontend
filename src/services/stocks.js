import { supabase } from "./supabase.js";

export const searchStocksSupabase = async (query, limit = 8) => {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("stocks")
    .select("stock_id,name,market")
    .or(`stock_id.ilike.%${q}%,name.ilike.%${q}%`)
    .order("stock_id", { ascending: true })
    .limit(limit);

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

export const fetchStockPricesSupabase = async (stockId, limit = 60) => {
  const id = String(stockId || "").trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from("stock_prices")
    .select("trade_date,open,high,low,close,average,volume,turnover")
    .eq("stock_id", id)
    .order("trade_date", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data || []).reverse();
};
