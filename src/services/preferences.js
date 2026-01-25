const PRICE_SCHEMES = {
  red_up: { up: "#d64545", down: "#1a7f37" },
  green_up: { up: "#1a7f37", down: "#d64545" },
};

export const getPriceScheme = () => {
  const stored = localStorage.getItem("twsvp_price_scheme");
  return stored && PRICE_SCHEMES[stored] ? stored : "red_up";
};

export const applyPriceScheme = (scheme) => {
  const key = PRICE_SCHEMES[scheme] ? scheme : "red_up";
  const root = document.documentElement;
  const colors = PRICE_SCHEMES[key];
  root.style.setProperty("--price-up", colors.up);
  root.style.setProperty("--price-down", colors.down);
  localStorage.setItem("twsvp_price_scheme", key);
  return key;
};
