// 短线情绪工作台 — 定时任务（唯一调用 Wind 的入口）
//
// Vercel Cron（vercel.json）在北京时间工作日 09:00–15:30 每 30 分钟触发；
// 具体执行哪些任务见 api/_lib/short-emotion/schedule.js。
//
// 手动补数（例如首次部署后立刻生成快照）：
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://twsvp.com/api/sync-short-emotion?force=1"
// 同一时段被重复触发只会执行一次；窗口外且已有数据时直接跳过，不调用 Wind。
import { runScheduledRefresh } from "./_lib/short-emotion/service.js";

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  const authorization = req.headers.authorization || "";
  const userAgent = String(req.headers["user-agent"] || "");
  const hasSecret = Boolean(CRON_SECRET) && authorization === `Bearer ${CRON_SECRET}`;
  const isVercelCron = req.headers["x-vercel-cron"] === "1" || userAgent.startsWith("vercel-cron/");
  const force = req.query?.force === "1";

  if (!hasSecret && !(isVercelCron && !force)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await runScheduledRefresh({ force: force && hasSecret });
    res.setHeader("Cache-Control", "no-store");
    res.status(result.status === "error" ? 500 : 200).json(result);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ status: "error", error: error instanceof Error ? error.message : String(error) });
  }
}
