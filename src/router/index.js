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
import { getCurrentUserSupabase } from "../services/auth.js";
import { resolveRouteAccess } from "./authGuard.js";
import { getProfileSupabase } from "../services/profile.js";
import { applyLanguagePreference, getLanguagePreference } from "../services/preferences.js";
import { trackPageView } from "../services/analytics.js";

const routes = [
  // 打开网站直接进入观点页：浏览全站不需要登录，只有发观点时才需要。
  { path: "/", redirect: "/feed" },
  { path: "/login", component: LoginView },
  { path: "/auth/callback", component: AuthCallbackView },
  { path: "/feed", component: FeedView },
  { path: "/feed/:id", component: FeedCardView },
  { path: "/create-feed", component: CreateFeedView, meta: { requiresAuth: true, loginReason: "post" } },
  { path: "/stock/:symbol", component: StockFeedView },
  { path: "/sector/:id", component: SectorFeedView },
  { path: "/search", component: SearchView },
  { path: "/news", component: NewsView },
  { path: "/notifications", component: NotificationsView },
  { path: "/personal-setting", component: PersonalSettingView, meta: { requiresAuth: true } },
  { path: "/user/:id", component: PersonalViewerView },
  { path: "/u/:code", component: PersonalViewerView },
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

router.beforeEach(async (to) => {
  const supabaseUser = await getCurrentUserSupabase();
  if (supabaseUser) {
    await ensureProfileLanguage(supabaseUser);
  }
  return resolveRouteAccess(to, supabaseUser);
});

router.afterEach((to) => {
  document.title = "TWSVP";
  trackPageView(to.path, document.title);
});

export default router;
