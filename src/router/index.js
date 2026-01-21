import { createRouter, createWebHistory } from "vue-router";
import FeedView from "../views/FeedView.vue";
import LoginView from "../views/LoginView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import ProfileView from "../views/ProfileView.vue";
import SearchView from "../views/SearchView.vue";
import SettingsView from "../views/SettingsView.vue";
import AuthCallbackView from "../views/AuthCallbackView.vue";
import { getMe } from "../services/auth.js";

const routes = [
  { path: "/", component: LoginView },
  { path: "/login", component: LoginView },
  { path: "/auth/callback", component: AuthCallbackView },
  { path: "/feed", component: FeedView },
  { path: "/search", component: SearchView },
  { path: "/notifications", component: NotificationsView },
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
  const user = await getMe();

  if (to.path === "/") {
    return user ? "/feed" : "/login";
  }

  if (isLoginRoute) {
    return user ? "/feed" : true;
  }

  return user ? true : "/login";
});

export default router;
