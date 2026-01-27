import { createClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_DAYS = {
  ultra_short: 4,
  short: 18,
  medium: 55,
  long: 150,
};

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const getUtcDayRange = (daysAgo) => {
  const todayStart = startOfUtcDay(new Date());
  const start = new Date(todayStart.getTime() - daysAgo * DAY_MS);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET } = process.env;
  if (CRON_SECRET) {
    const secret = req.headers["x-cron-secret"] || req.query?.secret;
    const isVercelCron =
      req.headers["x-vercel-cron"] === "1" ||
      `${req.headers["user-agent"] || ""}`.startsWith("vercel-cron/");
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

  try {
    const candidates = [];
    const detail = {};

    for (const [horizon, daysAgo] of Object.entries(REMINDER_DAYS)) {
      const { start, end } = getUtcDayRange(daysAgo);
      const { data, error } = await supabase
        .from("feeds")
        .select("feed_id,user_id,horizon,created_at,expires_at,status,deleted_at")
        .eq("horizon", horizon)
        .is("deleted_at", null)
        .neq("status", "expired")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());

      if (error) {
        throw new Error(`Feed query failed for ${horizon}: ${error.message}`);
      }

      detail[horizon] = data?.length || 0;
      if (data?.length) {
        candidates.push(...data);
      }
    }

    if (!candidates.length) {
      res.status(200).json({ status: "ok", created: 0, detail });
      return;
    }

    const feedIds = [...new Set(candidates.map((item) => item.feed_id))];
    const { data: existing, error: existingError } = await supabase
      .from("notifications")
      .select("target_feed_id")
      .eq("type", "expire_soon")
      .in("target_feed_id", feedIds);

    if (existingError) {
      throw new Error(`Notification lookup failed: ${existingError.message}`);
    }

    const existingSet = new Set(
      (existing || []).map((row) => row.target_feed_id).filter(Boolean)
    );
    const now = new Date().toISOString();
    const inserts = candidates
      .filter((item) => !existingSet.has(item.feed_id))
      .map((item) => ({
        type: "expire_soon",
        user_id: item.user_id,
        target_feed_id: item.feed_id,
        created_at: now,
      }));

    if (!inserts.length) {
      res.status(200).json({ status: "ok", created: 0, detail });
      return;
    }

    const { error: insertError } = await supabase.from("notifications").insert(inserts);
    if (insertError) {
      throw new Error(`Notification insert failed: ${insertError.message}`);
    }

    res.status(200).json({
      status: "ok",
      created: inserts.length,
      detail,
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
