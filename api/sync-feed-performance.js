import { createClient } from "@supabase/supabase-js";

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const toTaipeiDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return local.toISOString().slice(0, 10);
};

const getTaipeiMinutes = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

const shiftDate = (dateStr, days) => {
  if (!dateStr) return null;
  const base = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

const findFirstOnOrAfter = (dates, target) => {
  let left = 0;
  let right = dates.length - 1;
  let idx = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (dates[mid] >= target) {
      idx = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return idx;
};

const findLastOnOrBefore = (dates, target) => {
  let left = 0;
  let right = dates.length - 1;
  let idx = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (dates[mid] <= target) {
      idx = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return idx;
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

const chunkArray = (rows, size = 500) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
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
  const limit = Math.max(1, Number(params.limit || 500));
  const offset = Math.max(0, Number(params.offset || 0));
  const windowDays = Math.max(1, Number(params.window_days || params.windowDays || 7));
  const activeOnly =
    `${params.active_only || params.activeOnly || ""}` === "1" ||
    !("active_only" in params || "activeOnly" in params);
  const dryRun = `${params.dry_run || params.dryRun || ""}` === "1";
  const feedId = params.feed_id || params.feedId || null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    let query = supabase
      .from("feeds")
      .select(
        "feed_id,user_id,target_symbol,target_type,direction,status,created_at,expires_at"
      )
      .eq("target_type", "stock")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (feedId) {
      query = query.eq("feed_id", feedId);
    }
    if (activeOnly) {
      query = query.eq("status", "active");
    }

    const { data: feeds, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      throw new Error(`Feed query failed: ${error.message}`);
    }

    if (!feeds?.length) {
      res.status(200).json({ status: "ok", processed: 0, upserted: 0, skipped: 0 });
      return;
    }

    const today = toTaipeiDate(new Date());
    const prepared = feeds
      .map((feed) => {
        if (!feed.target_symbol) return null;
        const baseDate = toTaipeiDate(feed.created_at);
        const minutes = getTaipeiMinutes(feed.created_at);
        const session =
          minutes === null
            ? "normal"
            : minutes < 9 * 60
            ? "premarket"
            : minutes >= 15 * 60
            ? "postmarket"
            : "normal";
        if (!baseDate) return null;
        const expiresDate = feed.expires_at ? toTaipeiDate(feed.expires_at) : null;
        const isPastExpiry = expiresDate ? expiresDate <= today : false;
        const isEnded = feed.status === "expired" || isPastExpiry;
        const endDate = isEnded && expiresDate ? expiresDate : today;
        if (!endDate) return null;
        return {
          feedId: feed.feed_id,
          symbol: `${feed.target_symbol}`.trim(),
          direction: feed.direction,
          session,
          baseDate,
          endDate,
        };
      })
      .filter(Boolean)
      .filter((item) => item.symbol);

    if (!prepared.length) {
      res.status(200).json({ status: "ok", processed: 0, upserted: 0, skipped: 0 });
      return;
    }

    const grouped = new Map();
    for (const item of prepared) {
      if (!grouped.has(item.symbol)) grouped.set(item.symbol, []);
      grouped.get(item.symbol).push(item);
    }

    const records = [];
    const missing = [];
    let processed = 0;

    for (const [symbol, items] of grouped.entries()) {
      const baseDates = items.map((item) => item.baseDate).filter(Boolean);
      const endDates = items.map((item) => item.endDate).filter(Boolean);
      const minBase = baseDates.sort()[0];
      const maxEnd = endDates.sort().slice(-1)[0];
      const rangeStart = shiftDate(minBase, -windowDays) || minBase;
      const rangeEnd = shiftDate(maxEnd, windowDays) || maxEnd;

      const { data: prices, error: priceError } = await supabase
        .from("stock_prices")
        .select("trade_date,open,close")
        .eq("stock_id", symbol)
        .gte("trade_date", rangeStart)
        .lte("trade_date", rangeEnd)
        .order("trade_date", { ascending: true });

      if (priceError) {
        missing.push({ symbol, error: priceError.message });
        continue;
      }

      if (!prices?.length) {
        missing.push({ symbol, error: "no price data" });
        continue;
      }

      const dates = prices.map((row) => row.trade_date);

      for (const item of items) {
        processed += 1;
        const baseIndex =
          item.session === "postmarket"
            ? findLastOnOrBefore(dates, item.baseDate)
            : findFirstOnOrAfter(dates, item.baseDate);
        const endIndex = findLastOnOrBefore(dates, item.endDate);
        if (baseIndex === -1 || endIndex === -1 || baseIndex > endIndex) {
          missing.push({ feed_id: item.feedId, symbol: item.symbol, error: "price missing" });
          continue;
        }
        const baseRow = prices[baseIndex];
        const endRow = prices[endIndex];
        const baseOpen =
          item.session === "postmarket" ? Number(baseRow.close) : Number(baseRow.open);
        const endClose = Number(endRow.close);
        if (!Number.isFinite(baseOpen) || baseOpen <= 0 || !Number.isFinite(endClose)) {
          missing.push({
            feed_id: item.feedId,
            symbol: item.symbol,
            error: "invalid price",
          });
          continue;
        }
        const factor =
          item.direction === "short" ? -1 : item.direction === "neutral" ? 0 : 1;
        const performancePct =
          factor === 0 ? 0 : ((endClose - baseOpen) / baseOpen) * factor * 100;

        records.push({
          feed_id: item.feedId,
          base_date: baseRow.trade_date,
          end_date: endRow.trade_date,
          base_open: baseOpen,
          end_close: endClose,
          performance_pct: Number(performancePct.toFixed(6)),
        });
      }
    }

    let upserted = 0;
    if (!dryRun && records.length) {
      for (const chunk of chunkArray(records, 500)) {
        const { error: upsertError } = await supabase
          .from("feed_performance")
          .upsert(chunk, { onConflict: "feed_id" });
        if (upsertError) {
          throw new Error(`feed_performance upsert failed: ${upsertError.message}`);
        }
        upserted += chunk.length;
      }
    }

    res.status(200).json({
      status: "ok",
      processed,
      upserted: dryRun ? 0 : upserted,
      skipped: processed - records.length,
      dryRun,
      missing: missing.slice(0, 50),
    });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: error.message });
  }
}
