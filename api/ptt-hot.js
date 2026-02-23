import { createClient } from "@supabase/supabase-js";

const safeLimit = (value, fallback = 3) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
};

const safeSinceHours = (value, fallback = 24) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(720, Math.floor(parsed)));
};

const safeMinNetPush = (value, fallback = 20) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(-100, Math.min(1000, Math.floor(parsed)));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing required env vars" });
    return;
  }

  try {
    let stockId = `${req.query?.stock_id || req.query?.stockId || ""}`.trim();
    const stockName = `${req.query?.stock_name || req.query?.stockName || ""}`.trim();
    if (!stockId && !stockName) {
      res.status(400).json({ error: "Missing stock_id or stock_name", items: [] });
      return;
    }

    const limit = safeLimit(req.query?.limit, 3);
    const sinceHours = safeSinceHours(req.query?.since_hours || req.query?.sinceHours, 24);
    const minNetPush = safeMinNetPush(req.query?.min_net_push || req.query?.minNetPush, 20);
    const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    if (!stockId) {
      const { data: stockRows, error: stockError } = await supabase
        .from("stocks")
        .select("stock_id,name")
        .eq("name", stockName)
        .limit(2);
      if (stockError) {
        throw new Error(`Supabase stocks query failed: ${stockError.message}`);
      }
      if (!stockRows || !stockRows.length) {
        res.status(200).json({
          status: "ok",
          stock_id: null,
          stock_name: stockName,
          since_hours: sinceHours,
          min_net_push: minNetPush,
          total: 0,
          items: [],
        });
        return;
      }
      if (stockRows.length > 1) {
        res.status(400).json({
          error: "Stock name is ambiguous",
          detail: stockRows.map((row) => `${row.name}(${row.stock_id})`).join(", "),
          items: [],
        });
        return;
      }
      stockId = `${stockRows[0].stock_id}`;
    }

    const linkFetchLimit = Math.max(200, Math.min(2000, limit * 20));
    const { data: links, error: linkError } = await supabase
      .from("ptt_stock_links")
      .select("article_id,stock_id,matched_text,match_method")
      .eq("board", "Stock")
      .eq("stock_id", stockId)
      .order("created_at", { ascending: false })
      .limit(linkFetchLimit);
    if (linkError) {
      throw new Error(`Supabase ptt_stock_links query failed: ${linkError.message}`);
    }

    const articleIds = [...new Set((links || []).map((row) => row.article_id).filter(Boolean))];
    if (!articleIds.length) {
      res.status(200).json({
        status: "ok",
        stock_id: stockId,
        stock_name: stockName || null,
        since_hours: sinceHours,
        min_net_push: minNetPush,
        total: 0,
        items: [],
      });
      return;
    }

    const { data: articles, error: articleError } = await supabase
      .from("ptt_articles")
      .select("article_id,title,author,published_at,content,url,push_label,net_push,date_hint,fetched_at")
      .eq("board", "Stock")
      .in("article_id", articleIds)
      .gte("published_at", sinceIso)
      .gte("net_push", minNetPush)
      .not("content", "is", null)
      .neq("content", "")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (articleError) {
      throw new Error(`Supabase ptt_articles query failed: ${articleError.message}`);
    }

    const matchMap = new Map();
    for (const link of links || []) {
      if (!link?.article_id) continue;
      if (!matchMap.has(link.article_id)) {
        matchMap.set(link.article_id, []);
      }
      matchMap.get(link.article_id).push({
        matched_text: link.matched_text,
        match_method: link.match_method,
      });
    }

    const items = (articles || []).map((article) => ({
      ...article,
      stock_id: stockId,
      matches: matchMap.get(article.article_id) || [],
    }));

    res.status(200).json({
      status: "ok",
      stock_id: stockId || null,
      stock_name: stockName || null,
      since_hours: sinceHours,
      min_net_push: minNetPush,
      total: items.length,
      items,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message, items: [] });
  }
}
