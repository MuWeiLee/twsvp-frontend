import { createClient } from "@supabase/supabase-js";

const parseIsoTime = (value) => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const isRecentlyUpdated = (value, staleMinutes) => {
  const ts = parseIsoTime(value);
  if (!ts) return false;
  return Date.now() - ts <= staleMinutes * 60 * 1000;
};

const parseParams = (req) => {
  if (req.method !== "POST") return req.query || {};
  if (!req.body) return req.query || {};
  if (typeof req.body === "string") {
    try {
      return { ...(req.query || {}), ...JSON.parse(req.body) };
    } catch (_) {
      return req.query || {};
    }
  }
  return { ...(req.query || {}), ...(req.body || {}) };
};

const groupKeyOf = (row) => {
  const source = `${row.source || ""}`;
  const dataset = `${row.dataset || ""}`;
  const cursorDate = `${row.cursor_date || ""}`;
  const mode = `${row.detail?.mode || ""}`;
  return `${source}::${dataset}::${cursorDate}::${mode}`;
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

  const params = parseParams(req);
  const staleMinutes = Number(
    params.stale_minutes || process.env.STOCK_PRICE_CONFLICT_STALE_MINUTES || 20
  );
  const dryRun = `${params.dry_run || params.dryRun || "0"}` === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data, error } = await supabase
      .from("stock_price_backfill_state")
      .select("state_id,source,dataset,cursor_date,status,detail,updated_at")
      .eq("status", "running")
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (error) {
      throw new Error(`Backfill state query failed: ${error.message}`);
    }

    const groups = new Map();
    for (const row of data || []) {
      const key = groupKeyOf(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const keepIds = new Set();
    const closeTargets = [];
    for (const rows of groups.values()) {
      rows.sort((a, b) => (parseIsoTime(b.updated_at) || 0) - (parseIsoTime(a.updated_at) || 0));
      const leader = rows[0];
      const leaderIsRecent = isRecentlyUpdated(leader.updated_at, staleMinutes);
      if (leaderIsRecent) {
        keepIds.add(leader.state_id);
      } else {
        closeTargets.push({ state_id: leader.state_id, reason: "stale_running_state" });
      }
      for (let i = 1; i < rows.length; i += 1) {
        closeTargets.push({ state_id: rows[i].state_id, reason: "duplicate_running_state" });
      }
    }

    if (!dryRun) {
      for (const item of closeTargets) {
        await supabase
          .from("stock_price_backfill_state")
          .update({
            status: "superseded",
            finished_at: new Date().toISOString(),
            detail: { reason: item.reason, cleaned_by: "cleanup-stock-price-backfill-state" },
          })
          .eq("state_id", item.state_id)
          .eq("status", "running");
      }
    }

    res.status(200).json({
      status: "ok",
      dryRun,
      staleMinutes,
      runningBefore: (data || []).length,
      keepCount: keepIds.size,
      closedCount: closeTargets.length,
      closed: closeTargets,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
