const THREADS_SEARCH_URL = "https://www.threads.net/search";
const DUCKDUCKGO_SEARCH_URL = "https://duckduckgo.com/html/";

const normalizeKeyword = (value) => `${value || ""}`.trim();

const safeLimit = (value, fallback = 5) => {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(limit)));
};

const decodeHtml = (value = "") =>
  `${value}`
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

const normalizeText = (value = "") =>
  decodeHtml(`${value}`.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const fetchText = async (url, { headers = {}, timeoutMs = 12000 } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "twsvp-threads-search/1.0",
        Accept: "text/html,application/xhtml+xml",
        ...headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return await response.text();
  } catch (error) {
    return "";
  } finally {
    clearTimeout(timer);
  }
};

const normalizePostUrl = (value = "") => {
  const raw = `${value}`.trim();
  if (!raw) return "";

  let next = raw;
  if (raw.startsWith("/@")) next = `https://www.threads.net${raw}`;
  if (next.startsWith("//")) next = `https:${next}`;

  try {
    const parsed = new URL(next);
    if (!/threads\.net$/i.test(parsed.hostname)) return "";
    if (!/^\/@[^/]+\/post\/[^/?#]+/i.test(parsed.pathname)) return "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
};

const extractThreadsLinksFromHtml = (html = "") => {
  const links = new Set();
  const absolutePattern = /https?:\/\/(?:www\.)?threads\.net\/@[^"'<>/\\\s]+\/post\/[^"'<>\\\s/?#]+/gi;
  const relativePattern = /\/@[^"'<>/\\\s]+\/post\/[^"'<>\\\s/?#]+/gi;

  for (const match of html.matchAll(absolutePattern)) {
    const url = normalizePostUrl(match[0]);
    if (url) links.add(url);
  }

  for (const match of html.matchAll(relativePattern)) {
    const url = normalizePostUrl(match[0]);
    if (url) links.add(url);
  }

  return [...links];
};

const extractThreadsLinksFromDuckDuckGo = (html = "") => {
  const links = new Set();
  const anchorPattern =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtml(match[1] || "");
    if (!href) continue;
    let candidate = href;

    if (candidate.includes("duckduckgo.com/l/?")) {
      try {
        const redirectUrl = new URL(candidate, "https://duckduckgo.com");
        const target = redirectUrl.searchParams.get("uddg");
        if (target) candidate = decodeURIComponent(target);
      } catch (error) {
        continue;
      }
    }

    const normalized = normalizePostUrl(candidate);
    if (normalized) links.add(normalized);
  }

  return [...links];
};

const parseMeta = (html, key) => {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  return normalizeText(match?.[1] || "");
};

const parseThreadPost = async (url, keyword) => {
  const html = await fetchText(url);
  if (!html) return null;

  const title = parseMeta(html, "og:title") || normalizeText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
  const snippet = parseMeta(html, "og:description") || parseMeta(html, "description");
  const publishedAt =
    parseMeta(html, "article:published_time") ||
    parseMeta(html, "og:updated_time") ||
    parseMeta(html, "og:published_time");

  const body = `${title} ${snippet}`.toLowerCase();
  if (!body.includes(keyword.toLowerCase())) return null;

  const parsedUrl = new URL(url);
  const [, author = "", postId = ""] = parsedUrl.pathname.match(/^\/@([^/]+)\/post\/([^/?#]+)/i) || [];

  return {
    id: postId || url,
    title: title || "",
    url,
    author: author || "",
    snippet: snippet || "",
    published_at: publishedAt || null,
  };
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const keyword = normalizeKeyword(req.query?.keyword);
    if (!keyword) {
      res.status(400).json({ error: "Missing keyword" });
      return;
    }
    const limit = safeLimit(req.query?.limit, 5);

    const threadsSearchUrl = new URL(THREADS_SEARCH_URL);
    threadsSearchUrl.searchParams.set("q", keyword);
    const threadsHtml = await fetchText(threadsSearchUrl);

    const ddgUrl = new URL(DUCKDUCKGO_SEARCH_URL);
    ddgUrl.searchParams.set("q", `"${keyword}" site:threads.net/@`);
    ddgUrl.searchParams.set("kl", "tw-tzh");
    ddgUrl.searchParams.set("df", "w");
    const ddgHtml = await fetchText(ddgUrl);

    const candidates = [
      ...extractThreadsLinksFromHtml(threadsHtml),
      ...extractThreadsLinksFromDuckDuckGo(ddgHtml),
    ];

    const uniqueUrls = [...new Set(candidates)].slice(0, 16);
    if (!uniqueUrls.length) {
      res.status(200).json({
        status: "ok",
        platform: "threads",
        keyword,
        total: 0,
        items: [],
      });
      return;
    }

    const settled = await Promise.allSettled(uniqueUrls.map((url) => parseThreadPost(url, keyword)));
    const rows = settled
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value)
      .sort((a, b) => {
        const timeA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const timeB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);

    res.status(200).json({
      status: "ok",
      platform: "threads",
      keyword,
      total: rows.length,
      items: rows,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message, items: [] });
  }
}
