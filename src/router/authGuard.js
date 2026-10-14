import {
  consumeLoginRedirect,
  getProfileCompletionSupabase,
  rememberLoginRedirect,
} from "../services/auth.js";

export const ADMIN_EMAIL = "pai.product.manager@gmail.com";

// 登录规则：
// - 观点、个股、板块、搜索、挖掘、个人主页、通知、我的、设置等页面，访客都能直接打开；
// - 发观点（meta.requiresAuth，/create-feed）和首次登录后的资料补全（/personal-setting）需要登录；
// - 点赞、留言、关注由各页面在点击时请访客登录（services/loginPrompt.js），登录后回到原页面；
// - 后台只对管理员开放。
// 返回 true 表示放行，否则返回要跳转的地址。
export async function resolveRouteAccess(to, supabaseUser) {
  const isLoginRoute = to.path === "/login" || to.path === "/auth/callback";
  const isAdminRoute = to.path.startsWith("/admin");
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);

  if (isAdminRoute) {
    if (!supabaseUser) {
      return "/login";
    }
    return (supabaseUser.email || "") === ADMIN_EMAIL ? true : "/login";
  }

  if (isLoginRoute) {
    if (!supabaseUser) {
      return true;
    }
    const completed = await getProfileCompletionSupabase(supabaseUser.id);
    return completed ? consumeLoginRedirect() || "/feed" : "/personal-setting";
  }

  if (!requiresAuth) {
    return true;
  }

  if (!supabaseUser) {
    rememberLoginRedirect(to.fullPath);
    const reason = to.matched.find((record) => record.meta?.loginReason)?.meta.loginReason;
    return { path: "/login", query: reason ? { reason } : {} };
  }

  // 发观点前需要先补全资料（昵称 + 关注板块），补全后回到原来要去的页面。
  if (to.path !== "/personal-setting") {
    const completed = await getProfileCompletionSupabase(supabaseUser.id);
    if (!completed) {
      rememberLoginRedirect(to.fullPath);
      return "/personal-setting";
    }
  }

  return true;
}
