import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/base.css";
import {
  applyLanguagePreference,
  applyPriceScheme,
  applyThemePreference,
  getLanguagePreference,
  getPriceScheme,
  getThemePreference,
} from "./services/preferences.js";

applyPriceScheme(getPriceScheme());
applyThemePreference(getThemePreference());
applyLanguagePreference(getLanguagePreference());
createApp(App).use(router).mount("#app");
