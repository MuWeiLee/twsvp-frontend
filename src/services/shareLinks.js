export const encodeShareId = (value) => {
  if (!value) return "";
  const encoded = btoa(String(value));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const decodeShareId = (value) => {
  if (!value) return "";
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
  try {
    return atob(padded);
  } catch (error) {
    return "";
  }
};
