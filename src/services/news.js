import { supabase } from "./supabase";

const normalizePagination = (page = 1, pageSize = 20) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Number(pageSize) || 20);
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to };
};

export const fetchNewsSupabase = async (optionsOrLimit = 20) => {
  const options =
    typeof optionsOrLimit === "number" ? { page: 1, pageSize: optionsOrLimit } : optionsOrLimit;
  const page = Math.max(1, Number(options?.page || 1));
  const pageSize = Math.max(1, Number(options?.pageSize || options?.limit || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from("news_articles")
    .select(
      "article_id,title,link,description,content,pub_date,pub_date_tz,creator,source_id,source_url,source_icon"
    )
    .order("pub_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message || "Failed to fetch news");
  }

  return data || [];
};

export const searchNewsSupabase = async (query, limitOrOptions = {}) => {
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
    .from("news_articles")
    .select("article_id,title,link,description,content,pub_date,creator,source_id")
    .ilike("title", `%${q}%`)
    .order("pub_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    return [];
  }

  return data || [];
};
