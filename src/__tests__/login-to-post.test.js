import { describe, it, expect, vi, beforeEach } from "vitest";

const profileComplete = { value: true };

vi.mock("../services/supabase", () => ({
  supabase: { auth: { getSession: vi.fn(), getUser: vi.fn(), refreshSession: vi.fn() } },
}));

vi.mock("../services/auth.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProfileCompletionSupabase: vi.fn(async () => profileComplete.value),
    getCurrentUserSupabase: vi.fn(async () => null),
  };
});

const auth = await import("../services/auth.js");
const { resolveRouteAccess } = await import("../router/authGuard.js");
const { promptLogin, ensureCanPost, composeReturnPath } = await import("../services/loginPrompt.js");

const route = (path, { meta = {}, fullPath } = {}) => ({
  path,
  fullPath: fullPath || path,
  meta,
  matched: [{ meta }],
});

const POST_META = { requiresAuth: true, loginReason: "post" };
const USER = { id: "u1", email: "someone@example.com" };

const makeRouter = (current) => {
  const state = { value: current };
  return {
    currentRoute: state,
    push: vi.fn(async () => {}),
    resolve: ({ path, query }) => {
      const qs = new URLSearchParams(query).toString();
      return { fullPath: qs ? `${path}?${qs}` : path };
    },
  };
};

beforeEach(() => {
  localStorage.clear();
  profileComplete.value = true;
  vi.clearAllMocks();
});

describe("guests can browse everything except posting", () => {
  it.each([
    "/feed",
    "/feed/123",
    "/stock/2330",
    "/sector/5",
    "/search",
    "/news",
    "/user/abc",
    "/u/code",
    "/notifications",
    "/profile",
    "/settings",
    "/broker-selection",
    "/agreement/user",
  ])("lets a guest open %s", async (path) => {
    expect(await resolveRouteAccess(route(path), null)).toBe(true);
  });

  it("sends a guest who taps 发布 to login, and remembers to come back", async () => {
    const result = await resolveRouteAccess(route("/create-feed", { meta: POST_META }), null);
    expect(result).toEqual({ path: "/login", query: { reason: "post" } });
    expect(auth.consumeLoginRedirect()).toBe("/create-feed");
  });

  it("requires login for first-time profile setup", async () => {
    const result = await resolveRouteAccess(
      route("/personal-setting", { meta: { requiresAuth: true } }),
      null
    );
    expect(result).toEqual({ path: "/login", query: {} });
  });

  it("keeps the admin area for the admin only", async () => {
    expect(await resolveRouteAccess(route("/admin/backend/dashboard"), null)).toBe("/login");
    expect(await resolveRouteAccess(route("/admin/backend/dashboard"), USER)).toBe("/login");
    expect(
      await resolveRouteAccess(route("/admin/backend/dashboard"), {
        id: "a",
        email: "pai.product.manager@gmail.com",
      })
    ).toBe(true);
  });
});

describe("after login", () => {
  it("returns to the remembered page", async () => {
    auth.rememberLoginRedirect("/stock/2330?compose=1");
    expect(await resolveRouteAccess(route("/login"), USER)).toBe("/stock/2330?compose=1");
  });

  it("falls back to the feed when nothing was remembered", async () => {
    expect(await resolveRouteAccess(route("/auth/callback"), USER)).toBe("/feed");
  });

  it("asks a new user to finish their profile before posting, then returns", async () => {
    profileComplete.value = false;
    const result = await resolveRouteAccess(route("/create-feed", { meta: POST_META }), USER);
    expect(result).toBe("/personal-setting");
    expect(auth.consumeLoginRedirect()).toBe("/create-feed");
  });

  it("does not force profile setup just to browse", async () => {
    profileComplete.value = false;
    expect(await resolveRouteAccess(route("/feed"), USER)).toBe(true);
  });
});

describe("login redirect memory", () => {
  it("ignores unsafe or login paths", () => {
    auth.rememberLoginRedirect("https://evil.example.com");
    expect(auth.consumeLoginRedirect()).toBe(null);
    auth.rememberLoginRedirect("//evil.example.com");
    expect(auth.consumeLoginRedirect()).toBe(null);
    auth.rememberLoginRedirect("/login?reason=post");
    expect(auth.consumeLoginRedirect()).toBe(null);
  });

  it("is used once and expires after 30 minutes", () => {
    auth.rememberLoginRedirect("/feed/1");
    expect(auth.consumeLoginRedirect()).toBe("/feed/1");
    expect(auth.consumeLoginRedirect()).toBe(null);

    localStorage.setItem(
      "twsvp_login_redirect",
      JSON.stringify({ path: "/feed/1", at: Date.now() - 31 * 60 * 1000 })
    );
    expect(auth.consumeLoginRedirect()).toBe(null);
  });
});

describe("login prompts on actions", () => {
  it("remembers the current page and shows why login is needed", () => {
    const router = makeRouter(route("/feed/42", { fullPath: "/feed/42" }));
    promptLogin(router, { reason: "like" });
    expect(router.push).toHaveBeenCalledWith({ path: "/login", query: { reason: "like" } });
    expect(auth.consumeLoginRedirect()).toBe("/feed/42");
  });

  it("reopens the compose panel on the stock page after login", () => {
    const router = makeRouter({ path: "/stock/2330", fullPath: "/stock/2330", query: {} });
    expect(composeReturnPath(router)).toBe("/stock/2330?compose=1");
    const createRouter = makeRouter({ path: "/create-feed", fullPath: "/create-feed", query: {} });
    expect(composeReturnPath(createRouter)).toBe("/create-feed");
  });

  it("ensureCanPost sends a guest to login", async () => {
    auth.getCurrentUserSupabase.mockResolvedValueOnce(null);
    const router = makeRouter({ path: "/stock/2330", fullPath: "/stock/2330", query: {} });
    expect(await ensureCanPost(router)).toBe(null);
    expect(router.push).toHaveBeenCalledWith({ path: "/login", query: { reason: "post" } });
    expect(auth.consumeLoginRedirect()).toBe("/stock/2330?compose=1");
  });

  it("ensureCanPost sends a user with an unfinished profile to setup", async () => {
    auth.getCurrentUserSupabase.mockResolvedValueOnce(USER);
    profileComplete.value = false;
    const router = makeRouter({ path: "/create-feed", fullPath: "/create-feed", query: {} });
    expect(await ensureCanPost(router)).toBe(null);
    expect(router.push).toHaveBeenCalledWith("/personal-setting");
    expect(auth.consumeLoginRedirect()).toBe("/create-feed");
  });

  it("ensureCanPost lets a logged-in user post", async () => {
    auth.getCurrentUserSupabase.mockResolvedValueOnce(USER);
    const router = makeRouter({ path: "/create-feed", fullPath: "/create-feed", query: {} });
    expect(await ensureCanPost(router)).toEqual(USER);
    expect(router.push).not.toHaveBeenCalled();
  });
});
