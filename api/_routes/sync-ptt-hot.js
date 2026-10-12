import { createClient } from "@supabase/supabase-js";

const PTT_BASE_URL = "https://www.ptt.cc";
const PTT_SEARCH_URL = `${PTT_BASE_URL}/bbs/Stock/search`;

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_SINCE_HOURS = 24;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_MAX_ARTICLES = 30;
const DEFAULT_MIN_NET_PUSH = 20;

const parseParams = (req) => {
  if (req.method !== "POST") return req.query || {};
  if (!req.body) return req.query || {};
  if (typeof req.body === "string") {
    try {
      return { ...(req.query || {}), ...JSON.parse(req.body) };
    } catch (error) {
      return req.query || {};
    }
  }
  return { ...(req.query || {}), ...(req.body || {}) };
};

const normalizeText = (value = "") =>
  `${value}`
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const decodeHtml = (value = "") =>
  `${value}`
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch (error) {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch (error) {
        return "";
      }
    });

const fetchText = async (url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "twsvp-ptt-sync/1.0",
        Accept: "text/html,application/xhtml+xml",
        Cookie: "over18=1",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status, text: "" };
    }
    const text = await response.text();
    return { ok: true, status: 200, text };
  } catch (error) {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
};

const getTimestampFromPath = (path = "") => {
  const match = `${path}`.match(/M\.(\d+)\./);
  if (!match) return 0;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * 1000;
};

const parseNetPush = (value = "") => {
  const label = `${value || ""}`.trim();
  if (!label) return 0;
  if (label === "爆") return 100;
  const negative = label.match(/^X(\d+)$/i);
  if (negative) return -Number(negative[1] || 0);
  const numeric = Number(label);
  if (Number.isFinite(numeric)) return Math.trunc(numeric);
  return 0;
};

const extractPrevPageHref = (html = "") => {
  const groupMatch = `${html}`.match(/<div class="btn-group btn-group-paging">([\s\S]*?)<\/div>/i);
  if (!groupMatch) return "";
  const anchors = [...groupMatch[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const anchor of anchors) {
    const href = `${anchor[1] || ""}`.trim();
    const label = decodeHtml(normalizeText(anchor[2] || ""));
    if (label.includes("上頁") || label.includes("‹")) {
      return href;
    }
  }
  const links = anchors.map((match) => `${match[1] || ""}`.trim()).filter(Boolean);
  return links[1] || links[0] || "";
};

const parseSearchRows = (html = "") => {
  const chunks = `${html}`.split('<div class="r-ent">').slice(1);
  const rows = [];

  chunks.forEach((chunk) => {
    const titleMatch = chunk.match(
      /<div class="title">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<\/div>/i
    );
    if (!titleMatch) return;

    const href = `${titleMatch[1] || ""}`.trim();
    const title = decodeHtml(normalizeText(titleMatch[2] || ""));
    if (!href || !title) return;

    const authorMatch = chunk.match(/<div class="author">([\s\S]*?)<\/div>/i);
    const dateMatch = chunk.match(/<div class="date">([\s\S]*?)<\/div>/i);
    const pushMatch = chunk.match(/<div class="nrec">([\s\S]*?)<\/div>/i);
    const pushLabel = decodeHtml(normalizeText(pushMatch?.[1] || ""));
    const netPush = parseNetPush(pushLabel);
    const articleId = href.split("/").pop()?.replace(".html", "") || href;
    const publishedMs = getTimestampFromPath(href);

    rows.push({
      articleId,
      title,
      author: decodeHtml(normalizeText(authorMatch?.[1] || "")),
      dateLabel: decodeHtml(normalizeText(dateMatch?.[1] || "")),
      pushLabel,
      netPush,
      href,
      url: href.startsWith("http") ? href : `${PTT_BASE_URL}${href}`,
      publishedMs,
      publishedAt: publishedMs ? new Date(publishedMs).toISOString() : null,
    });
  });

  return rows;
};

const extractArticleBodyText = (html = "") => {
  const marker = '<div id="main-content"';
  const start = html.indexOf(marker);
  if (start < 0) return "";

  let block = html.slice(start);
  const cutCandidates = [
    block.indexOf('<div class="push"'),
    block.indexOf('<span class="f2">'),
    block.indexOf('<div id="article-polling"'),
  ].filter((value) => value >= 0);
  if (cutCandidates.length) {
    block = block.slice(0, Math.min(...cutCandidates));
  }

  block = block.replace(/^<div id="main-content"[^>]*>/i, "");
  block = block.replace(/<div class="article-metaline[^"]*"[\s\S]*?<\/div>/gi, "");
  block = block.replace(/<div class="article-metaline-right"[\s\S]*?<\/div>/gi, "");
  block = block.replace(/<!--[\s\S]*?-->/g, "");
  block = block.replace(/<br\s*\/?>/gi, "\n");
  block = decodeHtml(block);
  block = block.replace(/<[^>]+>/g, "");
  block = block.replace(/\r/g, "");

  const signatureMatch = block.search(/\n--\n/);
  if (signatureMatch >= 0) {
    block = block.slice(0, signatureMatch);
  }

  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => {
      const text = line.trim();
      if (!text) return false;
      if (text.startsWith("※ 發信站")) return false;
      if (text.startsWith("※ 文章網址")) return false;
      if (text.startsWith("※ 編輯")) return false;
      if (text.startsWith("◆ From")) return false;
      return true;
    });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const chunkRows = (rows, size = 200) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const mapWithConcurrency = async (items, limit, worker) => {
  const safeLimit = Math.max(1, Math.min(6, Number(limit) || 1));
  const results = new Array(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = null;
      }
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, runWorker));
  return results;
};

const safeNumber = (value, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const resolveStock = async (supabase, { stockIdInput = "", stockNameInput = "" }) => {
  const stockId = `${stockIdInput || ""}`.trim();
  const stockName = `${stockNameInput || ""}`.trim();

  if (stockId) {
    const { data, error } = await supabase
      .from("stocks")
      .select("stock_id,name")
      .eq("stock_id", stockId)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase stocks query failed: ${error.message}`);
    }
    if (!data) {
      throw new Error(`Stock not found for stock_id=${stockId}`);
    }
    return {
      stock_id: `${data.stock_id}`,
      stock_name: stockName || `${data.name || ""}`.trim() || stockId,
    };
  }

  if (!stockName) {
    throw new Error("Missing stock_name");
  }

  const { data: exact, error: exactError } = await supabase
    .from("stocks")
    .select("stock_id,name")
    .eq("name", stockName)
    .order("stock_id", { ascending: true })
    .limit(2);
  if (exactError) {
    throw new Error(`Supabase stocks query failed: ${exactError.message}`);
  }
  if ((exact || []).length === 1) {
    return {
      stock_id: `${exact[0].stock_id}`,
      stock_name: `${exact[0].name || stockName}`.trim(),
    };
  }
  if ((exact || []).length > 1) {
    throw new Error(`Stock name is ambiguous: ${stockName}`);
  }

  const { data: fuzzy, error: fuzzyError } = await supabase
    .from("stocks")
    .select("stock_id,name")
    .ilike("name", `%${stockName}%`)
    .order("stock_id", { ascending: true })
    .limit(5);
  if (fuzzyError) {
    throw new Error(`Supabase stocks query failed: ${fuzzyError.message}`);
  }

  if (!fuzzy || !fuzzy.length) {
    throw new Error(`Stock not found for stock_name=${stockName}`);
  }
  if (fuzzy.length > 1) {
    const candidates = fuzzy.map((row) => `${row.name}(${row.stock_id})`).join(", ");
    throw new Error(`Stock name is ambiguous: ${stockName}. Candidates: ${candidates}`);
  }

  return {
    stock_id: `${fuzzy[0].stock_id}`,
    stock_name: `${fuzzy[0].name || stockName}`.trim(),
  };
};

const collectHotRows = async ({
  keyword,
  sinceMs,
  maxPages,
  maxArticles,
  minNetPush,
}) => {
  const results = [];
  const seen = new Set();
  let stalePages = 0;
  let pageFetches = 0;
  let pageSuccesses = 0;
  let failedPageFetches = 0;

  let currentUrl = new URL(PTT_SEARCH_URL);
  currentUrl.searchParams.set("q", keyword);

  for (let page = 0; page < maxPages; page += 1) {
    if (!currentUrl) break;
    pageFetches += 1;
    const response = await fetchText(currentUrl.toString());
    if (!response.ok) {
      failedPageFetches += 1;
      continue;
    }
    pageSuccesses += 1;

    const rows = parseSearchRows(response.text);
    let pageHasRecentRows = false;
    for (const row of rows) {
      if (!row.articleId || seen.has(row.articleId)) continue;
      seen.add(row.articleId);
      if (row.netPush < minNetPush) continue;
      if (!row.publishedMs || row.publishedMs < sinceMs) continue;
      pageHasRecentRows = true;
      results.push(row);
      if (results.length >= maxArticles) {
        return {
          rows: results,
          pageFetches,
          pageSuccesses,
          failedPageFetches,
        };
      }
    }
    stalePages = pageHasRecentRows ? 0 : stalePages + 1;
    if (stalePages >= 3) break;

    const prevHref = extractPrevPageHref(response.text);
    if (!prevHref) break;
    currentUrl = new URL(prevHref, PTT_BASE_URL);
  }

  return {
    rows: results,
    pageFetches,
    pageSuccesses,
    failedPageFetches,
  };
};

export const syncOneStock = async ({
  supabase,
  stockIdInput = "",
  stockNameInput = "",
  sinceHours = DEFAULT_SINCE_HOURS,
  maxPages = DEFAULT_MAX_PAGES,
  maxArticles = DEFAULT_MAX_ARTICLES,
  minNetPush = DEFAULT_MIN_NET_PUSH,
  dryRun = false,
  requireContent = true,
}) => {
  const safeSinceHours = safeNumber(sinceHours, DEFAULT_SINCE_HOURS, { min: 1, max: 72 });
  const safeMaxPages = safeNumber(maxPages, DEFAULT_MAX_PAGES, { min: 1, max: 20 });
  const safeMaxArticles = safeNumber(maxArticles, DEFAULT_MAX_ARTICLES, { min: 1, max: 100 });
  const safeMinNetPush = safeNumber(minNetPush, DEFAULT_MIN_NET_PUSH, { min: -100, max: 1000 });

  const stock = await resolveStock(supabase, {
    stockIdInput,
    stockNameInput,
  });

  const sinceMs = Date.now() - safeSinceHours * 60 * 60 * 1000;
  const collected = await collectHotRows({
    keyword: stock.stock_name,
    sinceMs,
    maxPages: safeMaxPages,
    maxArticles: safeMaxArticles,
    minNetPush: safeMinNetPush,
  });

  if (collected.pageSuccesses === 0) {
    throw new Error("PTT fetch failed: unable to fetch search pages");
  }

  const detailed = await mapWithConcurrency(collected.rows, 3, async (item) => {
    const articleResponse = await fetchText(item.url);
    const content = articleResponse.ok ? extractArticleBodyText(articleResponse.text) : "";
    return {
      article_id: item.articleId,
      board: "Stock",
      stock_id: stock.stock_id,
      stock_name: stock.stock_name,
      title: item.title || null,
      author: item.author || null,
      published_at: item.publishedAt,
      content: content || null,
      url: item.url,
      push_label: item.pushLabel || "",
      net_push: item.netPush || 0,
      date_hint: item.dateLabel || null,
      fetched_at: new Date().toISOString(),
    };
  });

  const rows = (detailed || []).filter((row) => row && row.article_id && row.published_at);
  const rowsWithContent = rows.filter((row) => `${row.content || ""}`.trim().length > 0);
  const saveRows = requireContent ? rowsWithContent : rows;
  let saved = 0;

  if (!dryRun && saveRows.length) {
    const chunks = chunkRows(saveRows, 200);
    for (const chunk of chunks) {
      const { error } = await supabase.from("ptt_articles").upsert(chunk, {
        onConflict: "article_id,stock_id",
      });
      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
      saved += chunk.length;
    }
  }

  return {
    stock,
    since_hours: safeSinceHours,
    min_net_push: safeMinNetPush,
    queried: collected.rows.length,
    saved: dryRun ? 0 : saved,
    dryRun,
    items: saveRows,
    stats: {
      page_fetches: collected.pageFetches,
      page_successes: collected.pageSuccesses,
      page_failures: collected.failedPageFetches,
      with_content: rowsWithContent.length,
      without_content: rows.length - rowsWithContent.length,
      require_content: requireContent,
    },
  };
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET } = process.env;
  if (CRON_SECRET) {
    const secret = req.headers["x-cron-secret"] || req.query?.secret;
    const userAgent = `${req.headers["user-agent"] || ""}`;
    const isVercelCron =
      req.headers["x-vercel-cron"] === "1" || userAgent.startsWith("vercel-cron/");
    if (!isVercelCron && secret !== CRON_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Missing required env vars" });
    return;
  }

  try {
    const params = parseParams(req);
    const sinceHours = safeNumber(
      params.since_hours || params.sinceHours,
      DEFAULT_SINCE_HOURS,
      { min: 1, max: 72 }
    );
    const maxPages = safeNumber(params.max_pages || params.maxPages, DEFAULT_MAX_PAGES, {
      min: 1,
      max: 20,
    });
    const maxArticles = safeNumber(
      params.max_articles || params.maxArticles,
      DEFAULT_MAX_ARTICLES,
      { min: 1, max: 100 }
    );
    const minNetPush = safeNumber(
      params.min_net_push || params.minNetPush,
      DEFAULT_MIN_NET_PUSH,
      { min: -100, max: 1000 }
    );
    const dryRun = `${params.dry_run || ""}` === "1";
    const requireContent = `${params.require_content ?? "1"}` !== "0";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const result = await syncOneStock({
      supabase,
      stockIdInput: params.stock_id || params.stockId || "",
      stockNameInput: params.stock_name || params.stockName || params.keyword || "",
      sinceHours,
      maxPages,
      maxArticles,
      minNetPush,
      dryRun,
      requireContent,
    });
    res.status(200).json({ status: "ok", ...result });
  } catch (error) {
    const detail = error?.message || "Unexpected error";
    const isBadRequest =
      detail.startsWith("Missing stock_name") ||
      detail.startsWith("Stock not found") ||
      detail.startsWith("Stock name is ambiguous");
    const isUpstream = detail.startsWith("PTT fetch failed:");
    res.status(isBadRequest ? 400 : isUpstream ? 502 : 500).json({
      error: isBadRequest ? "Bad Request" : "Unexpected error",
      detail,
    });
  }
}
