// ===== CORS 工具 =====
const ALLOWED_ORIGINS = [
  "https://www.twsvp.com",
  "https://twsvp.com",
];

function withCORS(request, response) {
  const origin = request.headers.get("Origin");

  if (ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export { ALLOWED_ORIGINS, withCORS };
