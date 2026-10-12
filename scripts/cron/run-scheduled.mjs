// Called by .github/workflows/scheduled-jobs.yml.
// Vercel Hobby only allows once-a-day cron jobs, so GitHub Actions triggers the
// /api/sync-* endpoints instead. GitHub passes the cron expression that fired
// (github.event.schedule); this script maps it to endpoints via jobs.json, so a
// delayed GitHub run still calls the right jobs.
//
// Env: CRON_SECRET (required), SITE_URL (default https://twsvp.com),
//      CRON_SCHEDULE (scheduled runs), MANUAL_PATH (workflow_dispatch).
import { readFile } from "node:fs/promises";

const secret = process.env.CRON_SECRET;
const base = (process.env.SITE_URL || "https://twsvp.com").replace(/\/+$/, "");
const schedule = (process.env.CRON_SCHEDULE || "").trim();
const manualPath = (process.env.MANUAL_PATH || "").trim();
const timeoutMs = Number(process.env.CALL_TIMEOUT_MS || 310_000);

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!secret) fail("缺少 CRON_SECRET：请在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加，值与 Vercel 环境变量 CRON_SECRET 相同。");

const { jobs } = JSON.parse(await readFile(new URL("./jobs.json", import.meta.url), "utf8"));

let paths;
if (manualPath) {
  if (!manualPath.startsWith("/api/")) fail(`手动路径必须以 /api/ 开头：${manualPath}`);
  paths = [manualPath];
} else {
  paths = jobs.filter((job) => job.schedule === schedule).flatMap((job) => job.calls.map((call) => call.path));
  if (!paths.length) fail(`jobs.json 中没有与 schedule "${schedule}" 对应的任务`);
}

async function call(path) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}${path}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "x-cron-secret": secret,
        "User-Agent": "twsvp-github-actions-cron"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    const body = (await response.text()).replace(/\s+/g, " ").slice(0, 600);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${response.ok ? "✓" : "✗"} ${path} → ${response.status} (${seconds}s) ${body}`);
    return response.ok;
  } catch (error) {
    console.log(`✗ ${path} → ${error?.name === "TimeoutError" ? "timeout" : error?.message || error}`);
    return false;
  }
}

console.log(`schedule="${schedule || "manual"}" base=${base} calls=${paths.length}`);
const results = await Promise.all(paths.map(call));
const failed = results.filter((ok) => !ok).length;
if (failed) fail(`${failed}/${paths.length} 个接口调用失败`);
