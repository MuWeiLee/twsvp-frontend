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
