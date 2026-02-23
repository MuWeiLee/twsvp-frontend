const timeoutMs = Number(process.env.PTT_HEALTH_TIMEOUT_MS || 12000);

const run = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch("https://www.ptt.cc/bbs/Stock/index.html", {
      headers: {
        "User-Agent": "twsvp-ptt-health/1.0",
        Accept: "text/html,application/xhtml+xml",
        Cookie: "over18=1",
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const latencyMs = Date.now() - startedAt;
    const looksLikePtt = text.includes("btn-group-paging") || text.includes("批踢踢實業坊") || text.includes("看板 Stock");

    const payload = {
      ok: response.ok && looksLikePtt,
      status: response.status,
      latency_ms: latencyMs,
      looks_like_ptt: looksLikePtt,
      sample: text.slice(0, 120).replace(/\s+/g, " "),
    };

    console.log(JSON.stringify(payload, null, 2));
    if (!payload.ok) process.exit(1);
  } catch (error) {
    const payload = {
      ok: false,
      status: 0,
      latency_ms: Date.now() - startedAt,
      error: error?.name || "UnknownError",
      message: error?.message || "PTT health check failed",
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
};

await run();
