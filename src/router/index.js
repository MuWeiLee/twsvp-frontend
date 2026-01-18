import { createRouter, createWebHistory } from "vue-router";
import FeedView from "../views/FeedView.vue";
import LoginView from "../views/LoginView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import ProfileView from "../views/ProfileView.vue";
import SearchView from "../views/SearchView.vue";
import SettingsView from "../views/SettingsView.vue";

const routes = [
  { path: "/", component: LoginView },
  { path: "/login", component: LoginView },
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

const AUTH_CACHE_MS = 60000;
let authCheckedAt = 0;
let authed = false;

async function ensureAuth() {
  const now = Date.now();
  if (authCheckedAt && now - authCheckedAt < AUTH_CACHE_MS) {
    return authed;
  }

  try {
    const response = await fetch("https://api.twsvp.com/me", {
      credentials: "include",
    });
    if (!response.ok) {
      authed = false;
    } else {
      const data = await response.json();
      authed = Boolean(data && data.ok);
    }
  } catch (error) {
    authed = false;
  }

  authCheckedAt = now;
  return authed;
}

router.beforeEach(async (to) => {
  if (to.path === "/login") {
    const ok = await ensureAuth();
    return ok ? "/feed" : true;
  }

  const ok = await ensureAuth();
  return ok ? true : "/login";
});

export default router;
