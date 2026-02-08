import { createClient } from "@supabase/supabase-js";

const WINDOW_DAYS = [30];
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const toTaipeiDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return local.toISOString().slice(0, 10);
};

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
  const asOfDateParam = params.as_of_date || params.asOfDate || null;
  const dryRun = `${params.dry_run || params.dryRun || ""}` === "1";
  const windowDaysParam = params.window_days || params.windowDays || null;

  const asOfDate = asOfDateParam ? `${asOfDateParam}`.slice(0, 10) : null;
  const windowDays = windowDaysParam
    ? `${windowDaysParam}`
        .split(",")
        .map((value) => Number(value))
        .filter((value) => WINDOW_DAYS.includes(value))
    : WINDOW_DAYS;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const targetDate = asOfDate || toTaipeiDate(new Date());

    const { error: deleteError } = await supabase
      .from("user_performance")
      .delete()
      .eq("as_of_date", targetDate)
      .in("window_days", windowDays);

    if (deleteError) {
      throw new Error(`user_performance delete failed: ${deleteError.message}`);
    }

    if (dryRun) {
      res.status(200).json({ status: "ok", as_of_date: targetDate, window_days: windowDays });
      return;
    }

    const { error: insertError } = await supabase.rpc("sync_user_performance", {
      window_days: windowDays,
      as_of_date: targetDate,
    });

    if (insertError) {
      throw new Error(`sync_user_performance failed: ${insertError.message}`);
    }

    res.status(200).json({ status: "ok", as_of_date: targetDate, window_days: windowDays });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
