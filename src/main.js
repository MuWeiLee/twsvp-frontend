import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/base.css";
import { applyPriceScheme, getPriceScheme } from "./services/preferences.js";

applyPriceScheme(getPriceScheme());
createApp(App).use(router).mount("#app");
