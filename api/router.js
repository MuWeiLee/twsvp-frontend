// 单一入口：Vercel Hobby 计划每次部署最多 12 个 Serverless Functions，
// 原来 api/ 下每个文件都是一个函数（共 26 个），超限导致部署失败。
// 现在所有接口代码放在 api/_routes/（下划线目录不会被当成函数），
// vercel.json 把 /api/<name> 改写到这里，再按路径分发给原来的 handler。
// 对外 URL、参数和返回完全不变；新增接口时在下面的表里登记一行即可。
const ROUTES = {
  "cleanup-stock-price-backfill-state": () => import("./_routes/cleanup-stock-price-backfill-state.js"),
  "ptt-hot": () => import("./_routes/ptt-hot.js"),
  "ptt/hot": () => import("./_routes/ptt/hot.js"),
  "search-ptt-stock": () => import("./_routes/search-ptt-stock.js"),
  "search-threads": () => import("./_routes/search-threads.js"),
  "short-emotion": () => import("./_routes/short-emotion.js"),
  "sync-feed-expiry-notifications": () => import("./_routes/sync-feed-expiry-notifications.js"),
  "sync-feed-performance": () => import("./_routes/sync-feed-performance.js"),
  "sync-mops-rss": () => import("./_routes/sync-mops-rss.js"),
  "sync-news-stock-links": () => import("./_routes/sync-news-stock-links.js"),
  "sync-newsdata": () => import("./_routes/sync-newsdata.js"),
  "sync-ptt-hot-batch": () => import("./_routes/sync-ptt-hot-batch.js"),
  "sync-ptt-hot": () => import("./_routes/sync-ptt-hot.js"),
  "sync-ptt-stock-board": () => import("./_routes/sync-ptt-stock-board.js"),
  "sync-ptt-stock-links": () => import("./_routes/sync-ptt-stock-links.js"),
  "sync-quant-runs": () => import("./_routes/sync-quant-runs.js"),
  "sync-short-emotion": () => import("./_routes/sync-short-emotion.js"),
  "sync-stock-prices-backfill": () => import("./_routes/sync-stock-prices-backfill.js"),
  "sync-stock-prices-daily": () => import("./_routes/sync-stock-prices-daily.js"),
  "sync-stock-prices-history": () => import("./_routes/sync-stock-prices-history.js"),
  "sync-stock-prices-missing-scan": () => import("./_routes/sync-stock-prices-missing-scan.js"),
  "sync-stock-prices-missing": () => import("./_routes/sync-stock-prices-missing.js"),
  "sync-stock-prices": () => import("./_routes/sync-stock-prices.js"),
  "sync-stocks": () => import("./_routes/sync-stocks.js"),
  "sync-trading-calendar": () => import("./_routes/sync-trading-calendar.js"),
  "sync-user-performance": () => import("./_routes/sync-user-performance.js"),
};

export const ROUTE_NAMES = Object.keys(ROUTES);

export default async function handler(req, res) {
  const raw = req.query?.__route;
  let route = (Array.isArray(raw) ? raw.join("/") : String(raw || "")).replace(/^\/+|\/+$/g, "");
  if (!route) {
    // 兜底：若平台未把改写参数带进 query，就从原始路径解析 /api/<route>
    const pathname = String(req.url || "").split("?")[0];
    const match = pathname.match(/^\/api\/(.+?)\/?$/);
    if (match && match[1] !== "router") route = decodeURIComponent(match[1]);
  }
  if (req.query) delete req.query.__route;

  const load = Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
  if (!load) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  const { default: routeHandler } = await load();
  return routeHandler(req, res);
}
