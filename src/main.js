import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/base.css";
import {
  applyLanguagePreference,
  applyPriceScheme,
  getLanguagePreference,
  getPriceScheme,
} from "./services/preferences.js";

applyPriceScheme(getPriceScheme());
applyLanguagePreference(getLanguagePreference());
createApp(App).use(router).mount("#app");
