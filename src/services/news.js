import { supabase } from "./supabase";

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
