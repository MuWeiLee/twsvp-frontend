import { createRouter, createWebHistory } from "vue-router";
import FeedView from "../views/FeedView.vue";
import LoginView from "../views/LoginView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import ProfileView from "../views/ProfileView.vue";
import SearchView from "../views/SearchView.vue";
import SettingsView from "../views/SettingsView.vue";

const routes = [
  { path: "/", redirect: "/login" },
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

export default router;
