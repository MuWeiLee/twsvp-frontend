const PTT_SEARCH_URL = "https://www.ptt.cc/bbs/Stock/search";

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

const stripTags = (value = "") => `${value}`.replace(/<[^>]+>/g, " ");

const normalizeText = (value = "") =>
  decodeHtml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();

const getTimestampFromPath = (path = "") => {
  const match = `${path}`.match(/M\.(\d+)\./);
  if (!match) return 0;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * 1000;
};

const parsePttSearchItems = (html, keyword) => {
  const chunks = `${html}`.split('<div class="r-ent">').slice(1);
  const normalizedKeyword = keyword.toLowerCase();
  const rows = [];

  chunks.forEach((chunk, index) => {
    const titleMatch = chunk.match(
      /<div class="title">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<\/div>/i
    );
    if (!titleMatch) return;

    const href = `${titleMatch[1] || ""}`.trim();
    const title = normalizeText(titleMatch[2] || "");
    if (!href || !title) return;
    if (!title.toLowerCase().includes(normalizedKeyword)) return;

    const authorMatch = chunk.match(/<div class="author">([\s\S]*?)<\/div>/i);
    const dateMatch = chunk.match(/<div class="date">([\s\S]*?)<\/div>/i);
    const pushMatch = chunk.match(/<div class="nrec">([\s\S]*?)<\/div>/i);
    const timestamp = getTimestampFromPath(href);
    const articleId = href.split("/").pop()?.replace(".html", "") || href;

    rows.push({
      id: articleId,
      title,
      url: href.startsWith("http") ? href : `https://www.ptt.cc${href}`,
      author: normalizeText(authorMatch?.[1] || ""),
      snippet: "",
      push: normalizeText(pushMatch?.[1] || ""),
      date_label: normalizeText(dateMatch?.[1] || ""),
      published_at: timestamp ? new Date(timestamp).toISOString() : null,
      sort_time: timestamp || 0,
      sort_index: index,
    });
  });

  return rows.sort((a, b) => {
    if (b.sort_time !== a.sort_time) return b.sort_time - a.sort_time;
    return a.sort_index - b.sort_index;
  });
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

    const url = new URL(PTT_SEARCH_URL);
    url.searchParams.set("q", keyword);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "twsvp-ptt-search/1.0",
        Accept: "text/html,application/xhtml+xml",
        Cookie: "over18=1",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "PTT request failed", status: response.status, items: [] });
      return;
    }

    const html = await response.text();
    const rows = parsePttSearchItems(html, keyword)
      .slice(0, limit)
      .map(({ sort_time, sort_index, ...item }) => item);

    res.status(200).json({
      status: "ok",
      platform: "ptt-stock",
      keyword,
      total: rows.length,
      items: rows,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message, items: [] });
  }
}
