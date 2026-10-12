// 数据保留策略（Supabase 免费版 500MB，目标控制在 300MB 以内）
//
// - 日 K（stock_prices）：只保留最近 180 天；缺口扫描 / 缺口补录也只处理这 180 天，
//   避免把清理掉的旧数据重新下载回来。未到期观点需要的开仓日行情会额外保留。
// - 新闻（news_articles / news_stock_links）：只保留 3 天。
// - 同步日志与缺口清单：只保留 7 天。
// 可用环境变量覆盖：STOCK_PRICE_RETENTION_DAYS、NEWS_RETENTION_DAYS、LOG_RETENTION_DAYS。
import { getTaipeiDateString } from "./taipei-date.js";

const positiveInt = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

export const PRICE_RETENTION_DAYS = positiveInt(process.env.STOCK_PRICE_RETENTION_DAYS, 180);
export const NEWS_RETENTION_DAYS = positiveInt(process.env.NEWS_RETENTION_DAYS, 3);
export const LOG_RETENTION_DAYS = positiveInt(process.env.LOG_RETENTION_DAYS, 7);

/** YYYY-MM-DD shifted by whole days (UTC arithmetic on a date-only string). */
export function shiftDateString(date, days) {
  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** First trade_date (inclusive) kept for daily prices, in Taipei time. */
export function priceWindowStart(today = getTaipeiDateString()) {
  return shiftDateString(today, -PRICE_RETENTION_DAYS);
}

/** Clamp a requested start date so jobs never reach before the retention window. */
export function clampToPriceWindow(date, today = getTaipeiDateString()) {
  const windowStart = priceWindowStart(today);
  const value = String(date || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value > windowStart ? value : windowStart;
}

/** ISO timestamp before which news rows are removed. */
export function newsCutoffIso(now = new Date()) {
  return new Date(now.getTime() - NEWS_RETENTION_DAYS * 86_400_000).toISOString();
}

/** ISO timestamp before which sync logs / done missing-rows are removed. */
export function logCutoffIso(now = new Date()) {
  return new Date(now.getTime() - LOG_RETENTION_DAYS * 86_400_000).toISOString();
}
