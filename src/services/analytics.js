export const trackPageView = (pagePath, pageTitle) => {
  if (typeof window.gtag !== "undefined") {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
};

export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window.gtag !== "undefined") {
    window.gtag("event", eventName, parameters);
  }
};
