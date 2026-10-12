// Persistence for 短线情绪工作台 snapshots.
//
// Uses the project's existing Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// through PostgREST; tables are created by sql/short_emotion.sql. Without those env
// vars (local dev / tests) it falls back to an in-process memory store.

const KV_TABLE = "short_emotion_kv";
const HISTORY_TABLE = "short_emotion_history";
const DAILY_VIEW = "short_emotion_daily";
const HISTORY_SLOT_MS = 120_000; // one history row per 2-minute window, like the original workbench

function supabaseConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function storageMode() {
  return supabaseConfig() ? "supabase" : "memory";
}

export function historySlot(capturedAt) {
  return Math.floor(Date.parse(capturedAt) / HISTORY_SLOT_MS);
}

class SupabaseStore {
  constructor({ url, key }) {
    this.base = `${url}/rest/v1`;
    this.headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  }

  async request(path, { method = "GET", body, prefer, range } = {}) {
    const headers = { ...this.headers };
    if (prefer) headers.Prefer = prefer;
    if (range) Object.assign(headers, { "Range-Unit": "items", Range: range });
    const response = await fetch(`${this.base}/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
    const text = await response.text();
    if (!response.ok) {
      const hint = response.status === 404 || /does not exist|schema cache/i.test(text)
        ? "（请先在 Supabase 执行 sql/short_emotion.sql）" : "";
      throw new Error(`Supabase ${method} ${path.split("?")[0]} ${response.status}${hint}: ${text.slice(0, 200)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async kvGet(key) {
    const rows = await this.request(`${KV_TABLE}?key=eq.${encodeURIComponent(key)}&select=value,updated_at`);
    return rows?.[0] ? { value: rows[0].value, updatedAt: rows[0].updated_at } : null;
  }

  async kvSet(key, value) {
    await this.request(`${KV_TABLE}?on_conflict=key`, {
      method: "POST",
      body: [{ key, value, updated_at: new Date().toISOString() }],
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  }

  /** Atomic insert-if-absent; returns true when this caller created the key (used as a lock). */
  async kvSetIfAbsent(key, value) {
    const rows = await this.request(`${KV_TABLE}?on_conflict=key`, {
      method: "POST",
      body: [{ key, value, updated_at: new Date().toISOString() }],
      prefer: "resolution=ignore-duplicates,return=representation"
    });
    return Array.isArray(rows) && rows.length > 0;
  }

  async kvDeleteOlderThan(prefix, isoTime) {
    await this.request(`${KV_TABLE}?key=like.${encodeURIComponent(`${prefix}*`)}&updated_at=lt.${encodeURIComponent(isoTime)}`, {
      method: "DELETE", prefer: "return=minimal"
    });
  }

  async historyUpsert(record, inSession) {
    await this.request(`${HISTORY_TABLE}?on_conflict=slot`, {
      method: "POST",
      body: [{
        slot: historySlot(record.capturedAt),
        trading_date: record.tradingDate,
        captured_at: record.capturedAt,
        in_session: inSession,
        score: Number.isFinite(Number(record.score)) ? Number(record.score) : null,
        record
      }],
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  }

  async historyLatestDate() {
    const rows = await this.request(`${HISTORY_TABLE}?select=trading_date&order=trading_date.desc&limit=1`);
    return rows?.[0]?.trading_date || null;
  }

  async historyForDate(tradingDate) {
    const rows = await this.request(
      `${HISTORY_TABLE}?trading_date=eq.${encodeURIComponent(tradingDate)}&select=record&order=captured_at.asc`,
      { range: "0-999" }
    );
    return (rows || []).map((row) => row.record);
  }

  async dailyHistory() {
    const rows = await this.request(`${DAILY_VIEW}?select=*&order=trading_date.asc`, { range: "0-999" });
    return (rows || []).map((row) => ({
      tradingDate: row.trading_date,
      score: Number(row.score),
      sampleCount: Number(row.sample_count),
      firstCapturedAt: row.first_captured_at,
      lastCapturedAt: row.last_captured_at
    }));
  }

  async historyPrune(keepTradingDays) {
    const latest = await this.historyLatestDate();
    const days = (await this.dailyHistory()).map((item) => item.tradingDate);
    const allDays = [...new Set([...days, ...(latest ? [latest] : [])])].sort();
    if (allDays.length <= keepTradingDays) return 0;
    const cutoff = allDays[allDays.length - keepTradingDays];
    await this.request(`${HISTORY_TABLE}?trading_date=lt.${encodeURIComponent(cutoff)}`, { method: "DELETE", prefer: "return=minimal" });
    return allDays.length - keepTradingDays;
  }
}

class MemoryStore {
  constructor() {
    this.kv = new Map();
    this.history = new Map();
  }
  async kvGet(key) { return this.kv.get(key) || null; }
  async kvSet(key, value) { this.kv.set(key, { value, updatedAt: new Date().toISOString() }); }
  async kvSetIfAbsent(key, value) {
    if (this.kv.has(key)) return false;
    await this.kvSet(key, value);
    return true;
  }
  async kvDeleteOlderThan(prefix, isoTime) {
    for (const [key, entry] of this.kv) if (key.startsWith(prefix) && entry.updatedAt < isoTime) this.kv.delete(key);
  }
  async historyUpsert(record, inSession) {
    this.history.set(historySlot(record.capturedAt), { record, inSession });
  }
  async historyLatestDate() {
    return [...this.history.values()].map((row) => row.record.tradingDate).sort().at(-1) || null;
  }
  async historyForDate(tradingDate) {
    return [...this.history.values()].map((row) => row.record).filter((record) => record.tradingDate === tradingDate)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }
  async dailyHistory() {
    const groups = new Map();
    for (const { record, inSession } of this.history.values()) {
      if (!inSession || !Number.isFinite(Number(record.score))) continue;
      if (!groups.has(record.tradingDate)) groups.set(record.tradingDate, []);
      groups.get(record.tradingDate).push(record);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tradingDate, items]) => {
      items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      return {
        tradingDate,
        score: Math.round(items.reduce((sum, item) => sum + Number(item.score), 0) / items.length * 100) / 100,
        sampleCount: items.length,
        firstCapturedAt: items[0].capturedAt,
        lastCapturedAt: items.at(-1).capturedAt
      };
    });
  }
  async historyPrune(keepTradingDays) {
    const days = [...new Set([...this.history.values()].map((row) => row.record.tradingDate))].sort();
    if (days.length <= keepTradingDays) return 0;
    const cutoff = days[days.length - keepTradingDays];
    for (const [slot, row] of this.history) if (row.record.tradingDate < cutoff) this.history.delete(slot);
    return days.length - keepTradingDays;
  }
}

let memoryStore = null;

export function getStore() {
  const config = supabaseConfig();
  if (config) return new SupabaseStore(config);
  memoryStore ||= new MemoryStore();
  return memoryStore;
}
