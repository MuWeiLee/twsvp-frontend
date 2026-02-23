import { createClient } from "@supabase/supabase-js";

const PTT_BASE_URL = "https://www.ptt.cc";
const PTT_BOARD_INDEX_URL = `${PTT_BASE_URL}/bbs/Stock/index.html`;

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_SINCE_HOURS = 24;
const DEFAULT_MIN_NET_PUSH = 20;
const DEFAULT_MAX_PAGES = 60;
const DEFAULT_MAX_ARTICLES = 1000;

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

const safeNumber = (value, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

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
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    });

const normalizeText = (value = "") =>
  decodeHtml(
    `${value}`
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const fetchText = async (url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "twsvp-ptt-board-sync/1.0",
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
  } catch {
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
  const links = [...groupMatch[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>/gi)]
    .map((match) => `${match[1] || ""}`.trim())
    .filter(Boolean);
  return links[1] || "";
};

const parseBoardRows = (html = "") => {
  const chunks = `${html}`.split('<div class="r-ent">').slice(1);
  const rows = [];

  chunks.forEach((chunk) => {
    const titleMatch = chunk.match(
      /<div class="title">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<\/div>/i
    );
    if (!titleMatch) return;

    const href = `${titleMatch[1] || ""}`.trim();
    const title = normalizeText(titleMatch[2] || "");
    if (!href || !title) return;

    const authorMatch = chunk.match(/<div class="author">([\s\S]*?)<\/div>/i);
    const dateMatch = chunk.match(/<div class="date">([\s\S]*?)<\/div>/i);
    const pushMatch = chunk.match(/<div class="nrec">([\s\S]*?)<\/div>/i);
    const pushLabel = normalizeText(pushMatch?.[1] || "");
    const netPush = parseNetPush(pushLabel);
    const articleId = href.split("/").pop()?.replace(".html", "") || href;
    const publishedMs = getTimestampFromPath(href);

    rows.push({
      board: "Stock",
      articleId,
      title,
      author: normalizeText(authorMatch?.[1] || ""),
      dateLabel: normalizeText(dateMatch?.[1] || ""),
      pushLabel,
      netPush,
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
      } catch {
        results[index] = null;
      }
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, runWorker));
  return results;
};

const collectBoardRows = async ({ sinceMs, maxPages, maxArticles }) => {
  const rows = [];
  const seen = new Set();
  let pageFetches = 0;
  let pageSuccesses = 0;
  let pageFailures = 0;
  let currentUrl = PTT_BOARD_INDEX_URL;

  for (let page = 0; page < maxPages; page += 1) {
    if (!currentUrl) break;
    pageFetches += 1;
    const response = await fetchText(currentUrl);
    if (!response.ok) {
      pageFailures += 1;
      continue;
    }
    pageSuccesses += 1;

    const pageRows = parseBoardRows(response.text);
    for (const row of pageRows) {
      if (!row.articleId || seen.has(row.articleId)) continue;
      seen.add(row.articleId);
      if (!row.publishedMs || row.publishedMs < sinceMs) continue;
      rows.push(row);
      if (rows.length >= maxArticles) {
        return { rows, pageFetches, pageSuccesses, pageFailures };
      }
    }

    const oldestMs = pageRows.reduce((minValue, row) => {
      if (!row.publishedMs) return minValue;
      if (!Number.isFinite(minValue)) return row.publishedMs;
      return Math.min(minValue, row.publishedMs);
    }, Infinity);
    if (oldestMs < sinceMs) break;

    const prevHref = extractPrevPageHref(response.text);
    if (!prevHref) break;
    currentUrl = new URL(prevHref, PTT_BASE_URL).toString();
  }

  return { rows, pageFetches, pageSuccesses, pageFailures };
};

const createRun = async (supabase) => {
  const { data, error } = await supabase
    .from("ptt_sync_runs")
    .insert({
      stage: "crawl",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("run_id")
    .single();
  if (error) throw new Error(`Supabase run insert failed: ${error.message}`);
  return data?.run_id || null;
};

const finishRun = async (supabase, runId, payload) => {
  if (!runId) return;
  const { error } = await supabase
    .from("ptt_sync_runs")
    .update({
      ...payload,
      finished_at: new Date().toISOString(),
    })
    .eq("run_id", runId);
  if (error) {
    console.error("Failed to update ptt_sync_runs:", error.message);
  }
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let runId = null;
  try {
    const params = parseParams(req);
    const sinceHours = safeNumber(
      params.since_hours || params.sinceHours,
      DEFAULT_SINCE_HOURS,
      { min: 1, max: 72 }
    );
    const minNetPush = safeNumber(
      params.min_net_push || params.minNetPush,
      DEFAULT_MIN_NET_PUSH,
      { min: -100, max: 1000 }
    );
    const maxPages = safeNumber(params.max_pages || params.maxPages, DEFAULT_MAX_PAGES, {
      min: 1,
      max: 200,
    });
    const maxArticles = safeNumber(
      params.max_articles || params.maxArticles,
      DEFAULT_MAX_ARTICLES,
      { min: 1, max: 10000 }
    );
    const dryRun = `${params.dry_run || ""}` === "1";
    const requireContent = `${params.require_content ?? "1"}` !== "0";

    runId = await createRun(supabase);

    const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
    const collected = await collectBoardRows({ sinceMs, maxPages, maxArticles });
    if (collected.pageSuccesses === 0) {
      throw new Error("PTT fetch failed: unable to fetch board pages");
    }

    const scanned = collected.rows.length;
    const qualifiedRows = collected.rows.filter((row) => row.netPush >= minNetPush);
    const qualified = qualifiedRows.length;

    const articleIds = qualifiedRows.map((row) => row.articleId);
    const existingMap = new Map();
    if (articleIds.length) {
      const { data: existingRows, error: existingError } = await supabase
        .from("ptt_articles")
        .select("board,article_id,net_push,net_push_peak,first_seen_at,qualified_at")
        .eq("board", "Stock")
        .in("article_id", articleIds);
      if (existingError) {
        throw new Error(`Supabase existing articles query failed: ${existingError.message}`);
      }
      for (const row of existingRows || []) {
        existingMap.set(row.article_id, row);
      }
    }

    const nowIso = new Date().toISOString();
    const detailed = await mapWithConcurrency(qualifiedRows, 3, async (item) => {
      const response = await fetchText(item.url);
      const content = response.ok ? extractArticleBodyText(response.text) : "";
      const hasContent = `${content || ""}`.trim().length > 0;
      if (requireContent && !hasContent) return null;

      const existing = existingMap.get(item.articleId);
      const netPushPeak = Math.max(
        item.netPush,
        Number(existing?.net_push_peak ?? 0),
        Number(existing?.net_push ?? 0)
      );
      return {
        board: "Stock",
        article_id: item.articleId,
        title: item.title || null,
        author: item.author || null,
        published_at: item.publishedAt,
        content: hasContent ? content : null,
        url: item.url,
        push_label: item.pushLabel || "",
        net_push: item.netPush || 0,
        net_push_peak: netPushPeak,
        date_hint: item.dateLabel || null,
        fetched_at: nowIso,
        first_seen_at: existing?.first_seen_at || nowIso,
        last_seen_at: nowIso,
        qualified_at: existing?.qualified_at || nowIso,
      };
    });

    const saveRows = (detailed || []).filter(Boolean);
    let saved = 0;
    if (!dryRun && saveRows.length) {
      const chunks = chunkRows(saveRows, 200);
      for (const chunk of chunks) {
        const { error } = await supabase.from("ptt_articles").upsert(chunk, {
          onConflict: "board,article_id",
        });
        if (error) {
          throw new Error(`Supabase upsert failed: ${error.message}`);
        }
        saved += chunk.length;
      }
    }

    await finishRun(supabase, runId, {
      status: "ok",
      scanned,
      qualified,
      saved,
      linked: 0,
      error_message: null,
    });

    res.status(200).json({
      status: "ok",
      run_id: runId,
      since_hours: sinceHours,
      min_net_push: minNetPush,
      dryRun,
      require_content: requireContent,
      scanned,
      qualified,
      saved: dryRun ? 0 : saved,
      page_stats: {
        fetches: collected.pageFetches,
        successes: collected.pageSuccesses,
        failures: collected.pageFailures,
      },
      with_content: saveRows.length,
      without_content: qualified - saveRows.length,
    });
  } catch (error) {
    await finishRun(supabase, runId, {
      status: "failed",
      scanned: 0,
      qualified: 0,
      saved: 0,
      linked: 0,
      error_message: error.message,
    });
    const isUpstream = `${error.message || ""}`.startsWith("PTT fetch failed:");
    res.status(isUpstream ? 502 : 500).json({
      error: "Unexpected error",
      detail: error.message,
    });
  }
}
