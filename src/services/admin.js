import { supabase } from "./supabase";

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const buildLast7Days = () => {
  const today = startOfDay(new Date());
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({
      key: formatDateKey(date),
      date,
      count: 0,
    });
  }
  return days;
};

const groupByDay = (rows = []) => {
  const series = buildLast7Days();
  rows.forEach((row) => {
    const key = formatDateKey(row.created_at || row.pub_date || row.date);
    const item = series.find((entry) => entry.key === key);
    if (item) item.count += 1;
  });
  return series;
};

const safeSelect = async ({ table, select, fallbackSelect, filters }) => {
  const buildQuery = (selectValue, useNullFilters = true) => {
    let query = supabase.from(table).select(selectValue);
    if (filters?.range) {
      query = query
        .gte(filters.range.field, filters.range.from)
        .lte(filters.range.field, filters.range.to);
    }
    if (useNullFilters && filters?.isNull) {
      filters.isNull.forEach((field) => {
        query = query.is(field, null);
      });
    }
    return query;
  };

  const { data, error } = await buildQuery(select);
  if (!error) {
    return data || [];
  }
  if (!fallbackSelect) {
    console.error(`读取 ${table} 失败:`, error);
    return [];
  }
  const { data: fallbackData, error: fallbackError } = await buildQuery(
    fallbackSelect,
    false
  );
  if (fallbackError) {
    console.error(`读取 ${table} 失败:`, fallbackError);
    return [];
  }
  return fallbackData || [];
};

export const fetchDashboardMetrics = async () => {
  const today = startOfDay(new Date());
  const todayIso = today.toISOString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 6);
  const lastWeekIso = lastWeek.toISOString();

  const [usersRows, feedsRows, articlesRows] = await Promise.all([
    safeSelect({
      table: "users",
      select: "created_at",
      fallbackSelect: "created_at",
      filters: {
        range: { field: "created_at", from: lastWeekIso, to: tomorrowIso },
      },
    }).then(async (rows) => {
      if (rows.length) return rows;
      return safeSelect({
        table: "profiles",
        select: "created_at",
        fallbackSelect: "created_at",
        filters: {
          range: { field: "created_at", from: lastWeekIso, to: tomorrowIso },
        },
      });
    }),
    safeSelect({
      table: "feeds",
      select: "created_at, deleted_at",
      fallbackSelect: "created_at",
      filters: {
        range: { field: "created_at", from: lastWeekIso, to: tomorrowIso },
        isNull: ["deleted_at"],
      },
    }),
    safeSelect({
      table: "news_articles",
      select: "created_at, pub_date, deleted_at",
      fallbackSelect: "created_at, pub_date",
      filters: {
        range: { field: "created_at", from: lastWeekIso, to: tomorrowIso },
        isNull: ["deleted_at"],
      },
    }),
  ]);

  const countToday = (rows = []) =>
    rows.filter((row) => {
      const value = row.created_at || row.pub_date;
      if (!value) return false;
      const date = new Date(value).toISOString();
      return date >= todayIso && date < tomorrowIso;
    }).length;

  return {
    users: {
      today: countToday(usersRows),
      series: groupByDay(usersRows),
    },
    feeds: {
      today: countToday(feedsRows),
      series: groupByDay(feedsRows),
    },
    articles: {
      today: countToday(articlesRows),
      series: groupByDay(articlesRows),
    },
  };
};

export const fetchContentViews = async () => {
  const { data, error } = await supabase
    .from("feeds")
    .select(
      "feed_id, user_id, target_name, target_symbol, content, direction, horizon, status, created_at, users!feeds_user_id_fkey(nickname,email)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("读取观点列表失败:", error);
    return [];
  }
  return data || [];
};

export const fetchContentComments = async () => {
  const { data, error } = await supabase
    .from("feed_replies")
    .select(
      "reply_id, content, created_at, user_id, feed_id, users!feed_replies_user_id_fkey(nickname,email), feeds!feed_replies_feed_id_fkey(content)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("读取留言列表失败:", error);
    return [];
  }
  return data || [];
};

export const fetchArticles = async () => {
  const { data, error } = await supabase
    .from("news_articles")
    .select("article_id, title, description, created_at, pub_date")
    .order("pub_date", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("读取资讯列表失败:", error);
    return [];
  }

  return data || [];
};

export const fetchArticleStocks = async (articleIds = []) => {
  if (!articleIds.length) return [];
  const { data, error } = await supabase
    .from("news_stock_links")
    .select("article_id, stock_id, matched_text, stocks!news_stock_links_stock_id_fkey(name)")
    .in("article_id", articleIds);

  if (error) {
    console.error("读取资讯关联个股失败:", error);
    return [];
  }
  return data || [];
};

export const replaceArticleStocks = async (articleId, stocks = []) => {
  if (!articleId) return false;
  const { error: deleteError } = await supabase
    .from("news_stock_links")
    .delete()
    .eq("article_id", articleId);
  if (deleteError) {
    console.error("删除旧关联失败:", deleteError);
    return false;
  }
  if (!stocks.length) return true;
  const payload = stocks.map((stock) => ({
    article_id: articleId,
    stock_id: stock.stock_id,
    matched_text: stock.name || stock.stock_id,
    match_method: "manual",
  }));
  const { error } = await supabase.from("news_stock_links").insert(payload);
  if (error) {
    console.error("写入关联失败:", error);
    return false;
  }
  return true;
};

export const fetchStocksWithLatestPrice = async () => {
  const { data: latest, error: latestError } = await supabase
    .from("stock_prices")
    .select("trade_date")
    .order("trade_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error("读取最新行情日期失败:", latestError);
  }

  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("stock_id, name")
    .order("stock_id", { ascending: true })
    .limit(200);

  if (stocksError) {
    console.error("读取个股失败:", stocksError);
    return [];
  }

  let prices = [];
  if (latest?.trade_date) {
    const { data, error } = await supabase
      .from("stock_prices")
      .select("stock_id, open, close")
      .eq("trade_date", latest.trade_date);
    if (error) {
      console.error("读取最新行情失败:", error);
    } else {
      prices = data || [];
    }
  }

  const priceMap = new Map(prices.map((row) => [row.stock_id, row]));
  return (stocks || []).map((stock) => {
    const price = priceMap.get(stock.stock_id);
    const open = price?.open ?? null;
    const close = price?.close ?? null;
    const changePct =
      open && close ? (((close - open) / open) * 100).toFixed(2) : null;
    return {
      ...stock,
      latest_open: open,
      latest_close: close,
      latest_change_pct: changePct,
      latest_date: latest?.trade_date || null,
    };
  });
};

export const fetchPermissions = async () => {
  const { data, error } = await supabase
    .from("permissions")
    .select("permission_id, permission_type, permission_scope, target_codes, target_emails, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("读取权限失败:", error);
    return [];
  }
  return data || [];
};

export const upsertPermission = async (payload) => {
  const { error } = await supabase.from("permissions").upsert(payload, {
    onConflict: "permission_id",
  });
  if (error) {
    console.error("更新权限失败:", error);
    return false;
  }
  return true;
};

export const fetchAuditLogs = async () => {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("created_at, actor, action, target_type, target_id, summary")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("读取审计日志失败:", error);
    return [];
  }
  return data || [];
};

export const writeAuditLog = async ({ actor, action, targetType, targetId, summary }) => {
  const { error } = await supabase.from("audit_logs").insert({
    actor,
    action,
    target_type: targetType,
    target_id: targetId,
    summary,
  });
  if (error) {
    console.error("写入审计日志失败:", error);
    return false;
  }
  return true;
};

export const hideRecord = async ({ table, idField, id }) => {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq(idField, id);
  if (!error) return true;
  if (error.code === "42703") {
    const { error: deleteError } = await supabase.from(table).delete().eq(idField, id);
    if (deleteError) {
      console.error(`删除 ${table} 失败:`, deleteError);
      return false;
    }
    return true;
  }
  console.error(`隐藏 ${table} 失败:`, error);
  return false;
};

export const banUser = async (userId) => {
  const { error } = await supabase
    .from("users")
    .update({ status: "banned", banned_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    console.error("封禁账号失败:", error);
    return false;
  }
  return true;
};

export const searchUsersByEmail = async (query) => {
  const q = String(query || "").trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, nickname")
    .ilike("email", `%${q}%`)
    .limit(10);
  if (!error) return data || [];
  const { data: fallback, error: fallbackError } = await supabase
    .from("profiles")
    .select("user_id, email, nickname")
    .ilike("email", `%${q}%`)
    .limit(10);
  if (fallbackError) {
    console.error("检索用户失败:", fallbackError);
    return [];
  }
  return fallback || [];
};

const normalizeStrategyParams = (params) => {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};
  return params;
};

export const fetchQuantStrategies = async () => {
  const { data, error } = await supabase
    .from("quant_strategies")
    .select("strategy_id, name, description, params, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("读取量化策略失败:", error);
    return [];
  }

  return (data || []).map((item) => ({
    ...item,
    params: normalizeStrategyParams(item.params),
  }));
};

export const createQuantStrategy = async ({ name, description, params }) => {
  const payload = {
    name: String(name || "").trim(),
    description: String(description || "").trim() || null,
    params: normalizeStrategyParams(params),
    is_active: true,
  };

  const { data, error } = await supabase
    .from("quant_strategies")
    .insert(payload)
    .select("strategy_id, name, description, params, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("新增量化策略失败:", error);
    return null;
  }

  return data;
};

export const updateQuantStrategy = async (strategyId, patch = {}) => {
  if (!strategyId) return null;
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    payload.name = String(patch.name || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(patch, "description")) {
    payload.description = String(patch.description || "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "params")) {
    payload.params = normalizeStrategyParams(patch.params);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "is_active")) {
    payload.is_active = Boolean(patch.is_active);
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("quant_strategies")
    .update(payload)
    .eq("strategy_id", strategyId)
    .select("strategy_id, name, description, params, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("更新量化策略失败:", error);
    return null;
  }
  return data;
};

export const deleteQuantStrategy = async (strategyId) => {
  if (!strategyId) return false;
  const { error } = await supabase
    .from("quant_strategies")
    .delete()
    .eq("strategy_id", strategyId);

  if (error) {
    console.error("删除量化策略失败:", error);
    return false;
  }
  return true;
};

export const fetchQuantRunsByStrategy = async (strategyId) => {
  if (!strategyId) return [];
  const { data, error } = await supabase
    .from("quant_runs")
    .select(
      "run_id, strategy_id, status, start_date, end_date, summary, error_message, created_at, updated_at"
    )
    .eq("strategy_id", strategyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("读取策略回测任务失败:", error);
    return [];
  }
  return data || [];
};

export const fetchQuantRunDaily = async (runId) => {
  if (!runId) return [];
  const { data, error } = await supabase
    .from("quant_run_daily")
    .select("run_id, trade_date, daily_return, cumulative_return, created_at")
    .eq("run_id", runId)
    .order("trade_date", { ascending: false })
    .limit(400);

  if (error) {
    console.error("读取每日绩效失败:", error);
    return [];
  }
  return data || [];
};

export const fetchQuantRunPicks = async (runId) => {
  if (!runId) return [];
  const candidates = ["quant_run_picks", "quant_run_holdings"];

  for (const table of candidates) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("run_id", runId)
      .order("trade_date", { ascending: false })
      .limit(3000);

    if (!error) {
      return data || [];
    }
  }

  return [];
};

const toIsoDate = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const resolveBacktestWindow = async (lookbackDays = 60) => {
  const days = Math.max(1, Number(lookbackDays) || 60);
  const { data, error } = await supabase
    .from("trading_calendar")
    .select("trade_date")
    .order("trade_date", { ascending: false })
    .limit(days);

  if (!error && data && data.length) {
    const sorted = data
      .map((row) => row.trade_date)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));
    return {
      startDate: sorted[0],
      endDate: sorted[sorted.length - 1],
    };
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

export const queueQuantRun = async ({ strategyId, startDate, endDate }) => {
  if (!strategyId || !startDate || !endDate) return null;
  const { data, error } = await supabase
    .from("quant_runs")
    .insert({
      strategy_id: strategyId,
      status: "queued",
      start_date: startDate,
      end_date: endDate,
      summary: {},
    })
    .select(
      "run_id, strategy_id, status, start_date, end_date, summary, error_message, created_at, updated_at"
    )
    .single();

  if (error) {
    console.error("创建回测任务失败:", error);
    return null;
  }
  return data;
};
