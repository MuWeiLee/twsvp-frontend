// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import handler, { ROUTE_NAMES } from "../../api/router.js";

const apiDir = resolve(__dirname, "../../api");

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
  return res;
}

describe("api/router (single Vercel function)", () => {
  it("keeps the deployment under the Hobby limit of 12 functions", () => {
    const functions = readdirSync(apiDir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("_") && (entry.isDirectory() || entry.name.endsWith(".js")));
    expect(functions.map((entry) => entry.name)).toEqual(["router.js"]);
  });

  it("registers every handler file under api/_routes", () => {
    for (const route of ROUTE_NAMES) {
      expect(existsSync(resolve(apiDir, "_routes", `${route}.js`))).toBe(true);
    }
    expect(ROUTE_NAMES).toContain("ptt/hot");
    expect(ROUTE_NAMES).toContain("short-emotion");
    expect(ROUTE_NAMES).not.toContain("sync-short-emotion");
  });

  it("dispatches by the rewritten __route param and strips it from the query", async () => {
    process.env.WIND_MOCK = "1";
    delete process.env.SUPABASE_URL;
    const req = { method: "GET", headers: {}, url: "/api/router?__route=short-emotion&resource=status", query: { __route: "short-emotion", resource: "status" } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(req.query).toEqual({ resource: "status" });
  });

  it("falls back to the original /api/<route> path", async () => {
    const req = { method: "GET", headers: {}, url: "/api/short-emotion?resource=status", query: { resource: "status" } };
    const res = mockRes();
    await handler(req, res);
    expect(res.body.ok).toBe(true);
  });

  it("returns 404 for unknown routes", async () => {
    const res = mockRes();
    await handler({ method: "GET", headers: {}, url: "/api/nope", query: { __route: "nope" } }, res);
    expect(res.statusCode).toBe(404);
  });
});
