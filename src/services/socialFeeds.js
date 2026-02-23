const API_BASE = `${import.meta.env.VITE_API_BASE || ""}`.trim().replace(/\/+$/, "");

const buildApiUrl = (path, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, `${value}`);
  });
  const query = search.toString();
  const base = API_BASE || "";
  return `${base}${path}${query ? `?${query}` : ""}`;
};

const readItems = async (path, params = {}) => {
  try {
    const response = await fetch(buildApiUrl(path, params), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch (error) {
    return [];
  }
};

export const fetchThreadsByKeyword = async (keyword, limit = 5) => {
  const q = `${keyword || ""}`.trim();
  if (!q) return [];
  return readItems("/api/search-threads", { keyword: q, limit });
};

export const fetchPttStockByKeyword = async (keyword, limit = 5) => {
  const q = `${keyword || ""}`.trim();
  if (!q) return [];
  return readItems("/api/search-ptt-stock", { keyword: q, limit });
};
