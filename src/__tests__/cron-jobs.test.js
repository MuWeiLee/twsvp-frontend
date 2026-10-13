import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/scheduled-jobs.yml"), "utf8");
const { jobs } = JSON.parse(readFileSync(resolve(root, "scripts/cron/jobs.json"), "utf8"));
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));

const SHORT_EMOTION_CRON = "0,30 1-7 * * 1-5";
const workflowSchedules = [...workflow.matchAll(/-\s*cron:\s*"([^"]+)"/g)].map((match) => match[1]);
const activeSchedules = jobs.filter((job) => !job.paused).map((job) => job.schedule);

describe("scheduled jobs (GitHub Actions)", () => {
  it("runs the short-emotion job on its own schedule", () => {
    expect(workflowSchedules).toContain(SHORT_EMOTION_CRON);
    expect(workflow).toContain(`github.event.schedule == '${SHORT_EMOTION_CRON}'`);
  });

  it("every active API job is scheduled in the workflow, and nothing paused is", () => {
    for (const schedule of activeSchedules) expect(workflowSchedules).toContain(schedule);
    for (const schedule of workflowSchedules) {
      expect([...activeSchedules, SHORT_EMOTION_CRON]).toContain(schedule);
    }
  });

  it("every API job calls a route registered in api/router.js", async () => {
    const { ROUTE_NAMES } = await import("../../api/router.js");
    for (const job of jobs) {
      for (const call of job.calls) {
        const route = call.path.split("?")[0].replace(/^\/api\//, "");
        expect(ROUTE_NAMES).toContain(route);
      }
    }
  });

  it("vercel.json has no sub-daily crons (Hobby plan would reject the deployment)", () => {
    for (const cron of vercel.crons || []) {
      const [minute, hour] = cron.schedule.split(" ");
      expect(/^\d+$/.test(minute) && /^\d+$/.test(hour)).toBe(true);
    }
  });
});

describe("short-emotion URLs (A股 / 台股)", () => {
  it("serves /cn-short-emotion and /tw-short-emotion from the same page", () => {
    const rewrites = Object.fromEntries((vercel.rewrites || []).map((r) => [r.source, r.destination]));
    for (const path of ["/cn-short-emotion", "/cn-short-emotion/", "/tw-short-emotion", "/tw-short-emotion/"]) {
      expect(rewrites[path]).toBe("/short-emotion/index.html");
    }
  });

  it("redirects the old /short-emotion and common spellings to the A股 page", () => {
    const sources = (vercel.redirects || []).filter((r) => r.destination === "/cn-short-emotion").map((r) => r.source);
    for (const alias of ["/short-emotion", "/short-emotion/", "/shortEmotion", "/shortemotion", "/short_emotion", "/shortEmotion/"]) {
      expect(sources).toContain(alias);
    }
  });

  it("page rewrites come before the SPA catch-all", () => {
    const sources = (vercel.rewrites || []).map((r) => r.source);
    expect(sources.indexOf("/tw-short-emotion")).toBeLessThan(sources.indexOf("/((?!api/).*)"));
  });
});
