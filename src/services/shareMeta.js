const BASE_TITLE = "twsvp.com";

const escapeText = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const ensureMetaTag = (attr, key) => {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  return tag;
};

const setMeta = (attr, key, value) => {
  if (!value) return;
  const tag = ensureMetaTag(attr, key);
  tag.setAttribute("content", value);
};

export const buildShareDescription = (name) => `快来看看 ${name} 在TWSVP上的观点`;

export const buildShareImage = (name) => {
  const title = escapeText(BASE_TITLE);
  const line1 = escapeText(`快来看看 ${name}`);
  const line2 = escapeText("在TWSVP上的观点");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <style>
        .title { font: 600 52px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; fill: #111827; }
        .line { font: 400 42px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; fill: #1f2937; }
      </style>
    </defs>
    <rect width="1200" height="630" fill="#f3f4f6" />
    <rect x="80" y="80" width="1040" height="470" rx="28" fill="#ffffff" stroke="#e5e7eb" />
    <text x="140" y="220" class="title">${title}</text>
    <text x="140" y="320" class="line">${line1}</text>
    <text x="140" y="380" class="line">${line2}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const applyShareMeta = ({ name, url }) => {
  if (!name) return;
  const description = buildShareDescription(name);
  const image = buildShareImage(name);
  const finalUrl = url || window.location.href;

  document.title = BASE_TITLE;
  setMeta("property", "og:type", "website");
  setMeta("property", "og:title", BASE_TITLE);
  setMeta("property", "og:description", description);
  setMeta("property", "og:image", image);
  setMeta("property", "og:url", finalUrl);
  setMeta("property", "og:site_name", "TWSVP");
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", BASE_TITLE);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);
};
