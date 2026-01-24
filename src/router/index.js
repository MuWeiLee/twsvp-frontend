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
import CreateFeedView from "../views/CreateFeedView.vue";
import StockFeedView from "../views/StockFeedView.vue";
import SectorFeedView from "../views/SectorFeedView.vue";
import AuthCallbackView from "../views/AuthCallbackView.vue";
import { getCurrentUserSupabase, getMe, getProfileCompletionSupabase } from "../services/auth.js";

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

router.beforeEach(async (to) => {
  const isLoginRoute =
    to.path === "/" || to.path === "/login" || to.path === "/auth/callback";
  const supabaseUser = await getCurrentUserSupabase();
  const user = supabaseUser || (await getMe());

  if (user && supabaseUser) {
    const isPersonalSettingRoute = to.path === "/personal-setting";
    const completed = await getProfileCompletionSupabase(supabaseUser.id);
    if (!completed && !isLoginRoute && !isPersonalSettingRoute) {
      return "/personal-setting";
    }
    if (completed && isPersonalSettingRoute) {
      return "/feed";
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

  return user ? true : "/login";
});

export default router;
