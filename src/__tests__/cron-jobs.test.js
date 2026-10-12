import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/scheduled-jobs.yml"), "utf8");
const { jobs } = JSON.parse(readFileSync(resolve(root, "scripts/cron/jobs.json"), "utf8"));
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));

const workflowSchedules = [...workflow.matchAll(/-\s*cron:\s*"([^"]+)"/g)].map((match) => match[1]);

describe("scheduled jobs (GitHub Actions)", () => {
  it("workflow schedules and jobs.json stay in sync", () => {
    expect([...workflowSchedules].sort()).toEqual(jobs.map((job) => job.schedule).sort());
  });

  it("every job calls an existing /api/sync-* function", () => {
    for (const job of jobs) {
      for (const call of job.calls) {
        const file = call.path.split("?")[0].replace(/^\//, "");
        expect(() => readFileSync(resolve(root, `${file}.js`))).not.toThrow();
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
