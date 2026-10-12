// 短线情绪工作台 — 定时任务（唯一调用 Wind 的入口）
//
// 由 GitHub Actions（.github/workflows/scheduled-jobs.yml）在北京时间工作日
// 09:00–15:30 每 30 分钟调用；具体执行哪些任务见 api/_lib/short-emotion/schedule.js。
// 同一时段被重复触发只会执行一次；窗口外且已有数据时直接跳过，不调用 Wind。
//
// 手动补数（例如首次部署后立刻生成快照）：
//   GitHub → Actions → Scheduled jobs → Run workflow（默认路径即 ?force=1），或
//   curl -H "x-cron-secret: $CRON_SECRET" "https://twsvp.com/api/sync-short-emotion?force=1"
import { timingSafeEqual } from "node:crypto";
import { runScheduledRefresh } from "./_lib/short-emotion/service.js";

function secretMatches(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  const authorization = String(req.headers.authorization || "");
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : req.headers["x-cron-secret"];
  const hasSecret = secretMatches(provided, process.env.CRON_SECRET) || secretMatches(req.headers["x-cron-secret"], process.env.CRON_SECRET);
  const userAgent = String(req.headers["user-agent"] || "");
  const isVercelCron = req.headers["x-vercel-cron"] === "1" || userAgent.startsWith("vercel-cron/");
  const force = req.query?.force === "1";

  // Without the secret only a Vercel Cron call (scheduled, never forced) is accepted;
  // the per-slot lock in service.js bounds Wind usage even if that header is spoofed.
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
