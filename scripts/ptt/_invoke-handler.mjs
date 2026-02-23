const buildQuery = (urlPath) => {
  try {
    const url = new URL(urlPath, "http://localhost");
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
};

export const invokeHandler = async ({ handler, urlPath, method = "GET", body = undefined, userAgent = "ptt-runner/1.0" }) => {
  const headers = {
    "user-agent": userAgent,
  };
  if (process.env.CRON_SECRET) {
    headers["x-cron-secret"] = process.env.CRON_SECRET;
  }

  const req = {
    method,
    url: urlPath,
    query: buildQuery(urlPath),
    headers,
    body,
  };

  const result = {
    statusCode: 200,
    body: null,
  };

  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    },
  };

  await handler(req, res);

  return result;
};
