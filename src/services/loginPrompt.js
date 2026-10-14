import {
  getCurrentUserSupabase,
  getProfileCompletionSupabase,
  rememberLoginRedirect,
} from "./auth.js";

// 浏览全站不需要登录；只有要用自己的身份写东西时（发观点，以及点赞、留言、关注）才请访客登录。
// reason 决定登录页上的提示文案，returnTo 是登录完成后回到的页面（默认当前页）。
export const LOGIN_REASONS = ["post", "like", "comment", "follow", "notifications", "profile"];

export function promptLogin(router, { reason = "", returnTo } = {}) {
  const current = router.currentRoute.value;
  rememberLoginRedirect(returnTo ?? current.fullPath);
  const query = LOGIN_REASONS.includes(reason) ? { reason } : {};
  return router.push({ path: "/login", query });
}

// 在个股页等处打开发观点面板时，登录回来要自动重新打开面板：在当前地址上加 ?compose=1。
export function composeReturnPath(router) {
  const current = router.currentRoute.value;
  if (current.path === "/create-feed") return "/create-feed";
  return router.resolve({ path: current.path, query: { ...current.query, compose: "1" } }).fullPath;
}

// 发观点前的检查：未登录 → 去登录；首次登录还没补全资料 → 去补全资料。
// 两种情况都会记住 returnTo，完成后回来。可以发观点时返回当前用户，否则返回 null。
export async function ensureCanPost(router, { returnTo } = {}) {
  const target = returnTo ?? composeReturnPath(router);
  const user = await getCurrentUserSupabase({ force: true, ensureSession: true });
  if (!user) {
    promptLogin(router, { reason: "post", returnTo: target });
    return null;
  }
  const completed = await getProfileCompletionSupabase(user.id);
  if (!completed) {
    rememberLoginRedirect(target);
    router.push("/personal-setting");
    return null;
  }
  return user;
}
