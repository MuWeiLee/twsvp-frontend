// 短线情绪工作台 — 页面读接口（twsvp.com/short-emotion）
// GET /api/short-emotion?resource=emotion|anomalies|history|news|status
//
// 只读 Supabase 中由定时任务写入的快照，不调用 Wind；响应在 CDN 缓存 2 分钟，
// 访客再多也不会增加 Wind 额度消耗。
import { readResource, NotReadyError } from "../_lib/short-emotion/service.js";

const RESOURCES = new Set(["emotion", "anomalies", "history", "news", "status"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  const resource = String(req.query?.resource || "emotion");
  if (!RESOURCES.has(resource)) {
    res.status(404).json({ error: "接口不存在" });
    return;
  }
  try {
    const payload = await readResource(resource);
    res.setHeader("Cache-Control", resource === "status"
      ? "no-store"
      : "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
    res.status(200).json(payload);
  } catch (error) {
    const notReady = error instanceof NotReadyError;
    res.setHeader("Cache-Control", notReady ? "public, max-age=0, s-maxage=60" : "no-store");
    res.status(notReady ? 503 : error?.statusCode || 500).json({
      error: error instanceof Error ? error.message : String(error),
      code: notReady ? "not_ready" : "server_error"
    });
  }
}
