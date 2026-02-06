const pad2 = (value) => `${value}`.padStart(2, "0");

export const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const formatDateParam = (date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}${month}${day}`;
};

export const formatRocDate = (date, padMonth = true) => {
  const rocYear = date.getFullYear() - 1911;
  const month = padMonth ? pad2(date.getMonth() + 1) : date.getMonth() + 1;
  const day = padMonth ? pad2(date.getDate()) : date.getDate();
  return `${rocYear}/${month}/${day}`;
};

export const getDefaultStartDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return formatDate(date);
};

export const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const raw = `${value}`.replace(/,/g, "").trim();
  if (!raw || raw === "--" || raw === "-") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  if (text.trim().startsWith("<")) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

export const fetchTwseDaily = async (endpoint, date) => {
  const url = new URL(endpoint);
  url.searchParams.set("response", "json");
  url.searchParams.set("date", formatDateParam(date));
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) {
    throw new Error(`TWSE request failed ${response.status} ${response.statusText}`);
  }
  const payload = await parseJson(response);
  if (!payload || payload.stat !== "OK" || !Array.isArray(payload.data)) {
    return { rows: [], fields: [] };
  }
  return {
    rows: payload.data,
    fields: payload.fields || [],
  };
};

export const fetchTpexDaily = async (endpoint, date) => {
  const attempt = async (padMonth) => {
    const url = new URL(endpoint);
    url.searchParams.set("l", "zh-tw");
    url.searchParams.set("d", formatRocDate(date, padMonth));
    url.searchParams.set("se", "EW");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.tpex.org.tw/",
      },
    });
    if (!response.ok) {
      throw new Error(`TPEx request failed ${response.status} ${response.statusText}`);
    }
    const payload = await parseJson(response);
    if (!payload) return null;
    const rows = payload.aaData || payload.data || payload.table || [];
    const fields = payload.fields || payload.field || payload.title || [];
    return { rows, fields };
  };

  const padded = await attempt(true);
  if (padded && padded.rows?.length) return padded;
  const unpadded = await attempt(false);
  return unpadded || { rows: [], fields: [] };
};

export const findFieldIndex = (fields, candidates) => {
  if (!Array.isArray(fields)) return -1;
  return fields.findIndex((field) =>
    candidates.some((candidate) => `${field}`.includes(candidate))
  );
};

export const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const getDateRange = (start, end) => {
  const dates = [];
  const cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};
