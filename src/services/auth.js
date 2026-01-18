const API_BASE = "https://api.twsvp.com";
const AUTH_CACHE_MS = 60000;

let cachedUser = null;
let checkedAt = 0;

export async function getMe(options = {}) {
  const force = options.force === true;
  const now = Date.now();

  if (!force && checkedAt && now - checkedAt < AUTH_CACHE_MS) {
    return cachedUser;
  }

  try {
    const response = await fetch(`${API_BASE}/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      cachedUser = null;
    } else {
      const data = await response.json();
      cachedUser = data && data.ok ? data.user : null;
    }
  } catch (error) {
    cachedUser = null;
  }

  checkedAt = now;
  return cachedUser;
}

export function clearAuthCache() {
  cachedUser = null;
  checkedAt = 0;
}
