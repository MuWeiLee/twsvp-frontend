import { withCORS } from "../worker.js";

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return withCORS(
        request,
        new Response(null, { status: 204, headers: DEFAULT_HEADERS })
      );
    }

    const origin = env.API_ORIGIN;
    if (!origin) {
      return withCORS(
        request,
        new Response(JSON.stringify({ ok: false, error: "API_ORIGIN not set" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...DEFAULT_HEADERS },
        })
      );
    }

    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, origin);
    const proxyRequest = new Request(target, request);

    const upstreamResponse = await fetch(proxyRequest);
    const response = new Response(upstreamResponse.body, upstreamResponse);

    return withCORS(request, response);
  },
};
