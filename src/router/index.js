import { createRouter, createWebHistory } from "vue-router";
import FeedView from "../views/FeedView.vue";
import FeedCardView from "../views/FeedCardView.vue";
import LoginView from "../views/LoginView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import PersonalSettingView from "../views/PersonalSettingView.vue";
import PersonalViewerView from "../views/PersonalViewerView.vue";
import ProfileView from "../views/ProfileView.vue";
import NewsView from "../views/NewsView.vue";
import SearchView from "../views/SearchView.vue";
import SettingsView from "../views/SettingsView.vue";
import BrokerSelectionView from "../views/BrokerSelectionView.vue";
import CreateFeedView from "../views/CreateFeedView.vue";
import StockFeedView from "../views/StockFeedView.vue";
import SectorFeedView from "../views/SectorFeedView.vue";
import AuthCallbackView from "../views/AuthCallbackView.vue";
import UserAgreementView from "../views/UserAgreementView.vue";
import PrivacyPolicyView from "../views/PrivacyPolicyView.vue";
import AdminLayout from "../views/admin/AdminLayout.vue";
import AdminDashboardView from "../views/admin/AdminDashboardView.vue";
import AdminContentViews from "../views/admin/AdminContentViews.vue";
import AdminContentComments from "../views/admin/AdminContentComments.vue";
import AdminPlatformArticles from "../views/admin/AdminPlatformArticles.vue";
import AdminPlatformStrategyPacks from "../views/admin/AdminPlatformStrategyPacks.vue";
import AdminStocksList from "../views/admin/AdminStocksList.vue";
import AdminStockDetail from "../views/admin/AdminStockDetail.vue";
import AdminSystemPermissions from "../views/admin/AdminSystemPermissions.vue";
import AdminSystemAuditLogs from "../views/admin/AdminSystemAuditLogs.vue";
import {
  consumeLoginRedirect,
  getCurrentUserSupabase,
  getProfileCompletionSupabase,
  rememberLoginRedirect,
} from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";
import { applyLanguagePreference, getLanguagePreference } from "../services/preferences.js";
import { trackPageView } from "../services/analytics.js";

const routes = [
  { path: "/", component: LoginView },
  { path: "/login", component: LoginView },
  { path: "/auth/callback", component: AuthCallbackView },
  { path: "/feed", component: FeedView, meta: { public: true } },
  { path: "/feed/:id", component: FeedCardView, meta: { public: true } },
  { path: "/create-feed", component: CreateFeedView },
  { path: "/stock/:symbol", component: StockFeedView, meta: { public: true } },
  { path: "/sector/:id", component: SectorFeedView, meta: { public: true } },
  { path: "/search", component: SearchView, meta: { public: true } },
  { path: "/news", component: NewsView, meta: { public: true } },
  { path: "/notifications", component: NotificationsView },
  { path: "/personal-setting", component: PersonalSettingView },
  { path: "/user/:id", component: PersonalViewerView, meta: { public: true } },
  { path: "/u/:code", component: PersonalViewerView, meta: { public: true } },
  { path: "/profile", component: ProfileView },
  { path: "/settings", component: SettingsView },
  { path: "/broker-selection", component: BrokerSelectionView },
  { path: "/agreement/user", component: UserAgreementView },
  { path: "/agreement/privacy", component: PrivacyPolicyView },
  { path: "/admin", redirect: "/admin/backend/dashboard" },
  { path: "/admin/dashboard", redirect: "/admin/backend/dashboard" },
  {
    path: "/admin/backend",
    component: AdminLayout,
    children: [
      {
        path: "dashboard",
        component: AdminDashboardView,
        meta: { section: "data" },
      },
      {
        path: "content/views",
        component: AdminContentViews,
        meta: { section: "content" },
      },
      {
        path: "content/comments",
        component: AdminContentComments,
        meta: { section: "content" },
      },
      {
        path: "platform/articles",
        component: AdminPlatformArticles,
        meta: { section: "platform" },
      },
      {
        path: "platform/strategy-packs",
        component: AdminPlatformStrategyPacks,
        meta: { section: "platform" },
      },
      {
        path: "stocks",
        component: AdminStocksList,
        meta: { section: "stocks" },
      },
      {
        path: "stocks/:code",
        component: AdminStockDetail,
        meta: { section: "stocks" },
      },
      {
        path: "system/permissions",
        component: AdminSystemPermissions,
        meta: { section: "system" },
      },
      {
        path: "system/audit-logs",
        component: AdminSystemAuditLogs,
        meta: { section: "system" },
      },
      { path: "", redirect: "/admin/backend/dashboard" },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/feed" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: "smooth" };
    }
    return { left: 0, top: 0 };
  },
});

const ADMIN_EMAIL = "pai.product.manager@gmail.com";

let languageApplied = false;

const ensureProfileLanguage = async (supabaseUser) => {
  if (languageApplied || !supabaseUser) return;
  const stored = localStorage.getItem("twsvp_language");
  if (stored) {
    applyLanguagePreference(getLanguagePreference());
    languageApplied = true;
    return;
  }
  const profile = await getProfileSupabase(supabaseUser.id);
  if (profile?.language) {
    applyLanguagePreference(profile.language);
  }
  languageApplied = true;
};

// 公开浏览：带 meta.public 的只读页面（观点、个股、板块、搜索、新闻、个人主页）无需登录；
// 发观点、通知、个人资料、设置、券商设置与后台仍需登录。
router.beforeEach(async (to, from) => {
  const isPublicRoute = to.matched.some((record) => record.meta?.public);
  const isLoginRoute =
    to.path === "/" || to.path === "/login" || to.path === "/auth/callback";
  const isAgreementRoute =
    to.path === "/agreement/user" || to.path === "/agreement/privacy";
  const isAdminRoute = to.path.startsWith("/admin");
  const supabaseUser = await getCurrentUserSupabase();

  if (supabaseUser) {
    await ensureProfileLanguage(supabaseUser);
  }

  if (isAdminRoute) {
    if (!supabaseUser) {
      return "/login";
    }
    const email = supabaseUser.email || "";
    return email === ADMIN_EMAIL ? true : "/login";
  }

  if (supabaseUser) {
    const isPersonalSettingRoute = to.path === "/personal-setting";
    const completed = await getProfileCompletionSupabase(supabaseUser.id);
    if (!completed && !isLoginRoute && !isPersonalSettingRoute && !isAgreementRoute) {
      return "/personal-setting";
    }
    if (completed && isPersonalSettingRoute) {
      return true;
    }
  }

  if (isLoginRoute) {
    if (!supabaseUser) {
      // 从公开页面点了需要登录的操作（点赞、关注、发观点等）时，登录后回到原页面。
      if (to.path === "/login" && from.matched.length && from.matched.some((record) => record.meta?.public)) {
        rememberLoginRedirect(from.fullPath);
      }
      return true;
    }
    const completed = await getProfileCompletionSupabase(supabaseUser.id);
    return completed ? consumeLoginRedirect() || "/feed" : "/personal-setting";
  }

  if (isAgreementRoute || isPublicRoute) {
    return true;
  }

  if (supabaseUser) {
    return true;
  }
  rememberLoginRedirect(to.fullPath);
  return "/login";
});

router.afterEach((to) => {
  document.title = "TWSVP";
  trackPageView(to.path, document.title);
});

export default router;
