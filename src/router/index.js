import { createRouter, createWebHistory } from "vue-router";
import FeedView from "../views/FeedView.vue";
import FeedCardView from "../views/FeedCardView.vue";
import LoginView from "../views/LoginView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import PersonalSettingView from "../views/PersonalSettingView.vue";
import PersonalViewerView from "../views/PersonalViewerView.vue";
import ProfileView from "../views/ProfileView.vue";
import SearchView from "../views/SearchView.vue";
import SettingsView from "../views/SettingsView.vue";
import BrokerSelectionView from "../views/BrokerSelectionView.vue";
import CreateFeedView from "../views/CreateFeedView.vue";
import StockFeedView from "../views/StockFeedView.vue";
import SectorFeedView from "../views/SectorFeedView.vue";
import AuthCallbackView from "../views/AuthCallbackView.vue";
import UserAgreementView from "../views/UserAgreementView.vue";
import PrivacyPolicyView from "../views/PrivacyPolicyView.vue";
import { getCurrentUserSupabase, getMe, getProfileCompletionSupabase } from "../services/auth.js";
import { getProfileSupabase } from "../services/profile.js";
import { applyLanguagePreference, getLanguagePreference } from "../services/preferences.js";

const routes = [
  { path: "/", component: LoginView },
  { path: "/login", component: LoginView },
  { path: "/auth/callback", component: AuthCallbackView },
  { path: "/feed", component: FeedView },
  { path: "/feed/:id", component: FeedCardView },
  { path: "/create-feed", component: CreateFeedView },
  { path: "/stock/:symbol", component: StockFeedView },
  { path: "/sector/:id", component: SectorFeedView },
  { path: "/search", component: SearchView },
  { path: "/notifications", component: NotificationsView },
  { path: "/personal-setting", component: PersonalSettingView },
  { path: "/user/:id", component: PersonalViewerView },
  { path: "/profile", component: ProfileView },
  { path: "/settings", component: SettingsView },
  { path: "/broker-selection", component: BrokerSelectionView },
  { path: "/agreement/user", component: UserAgreementView },
  { path: "/agreement/privacy", component: PrivacyPolicyView },
  { path: "/:pathMatch(.*)*", redirect: "/login" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: "smooth" };
    }
    return { top: 0 };
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
  const isLoginRoute =
    to.path === "/" || to.path === "/login" || to.path === "/auth/callback";
  const isAgreementRoute =
    to.path === "/agreement/user" || to.path === "/agreement/privacy";
  const supabaseUser = await getCurrentUserSupabase();
  const user = supabaseUser || (await getMe());

  if (supabaseUser) {
    await ensureProfileLanguage(supabaseUser);
  }

  if (user && supabaseUser) {
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
    if (!user) {
      return true;
    }
    if (supabaseUser) {
      const completed = await getProfileCompletionSupabase(supabaseUser.id);
      return completed ? "/feed" : "/personal-setting";
    }
    return "/feed";
  }

  if (isAgreementRoute) {
    return true;
  }

  return user ? true : "/login";
});

export default router;
