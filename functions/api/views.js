const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function hashVisitor(request, salt) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptIp(ip, secret) {
  if (!secret) return null;
  const encoder = new TextEncoder();
  const keyBytes = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(ip)));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv); packed.set(encrypted, iv.length);
  return btoa(String.fromCharCode(...packed));
}

async function describeVisitor(request, visitor, encryptionKey) {
  const cf = request.cf || {};
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const agent = request.headers.get("User-Agent") || "";
  const referrer = request.headers.get("X-Visitor-Referrer") || request.headers.get("Referer") || "";
  let referrerHost = "Direct";
  try { referrerHost = new URL(referrer).hostname || "Direct"; } catch {}

  const device = /ipad|tablet/i.test(agent) ? "Tablet" : /mobile|android|iphone/i.test(agent) ? "Mobile" : "Desktop";
  const browser = /edg\//i.test(agent) ? "Edge" : /firefox\//i.test(agent) ? "Firefox" : /chrome\//i.test(agent) ? "Chrome" : /safari\//i.test(agent) ? "Safari" : "Other";
  const os = /windows/i.test(agent) ? "Windows" : /android/i.test(agent) ? "Android" : /iphone|ipad/i.test(agent) ? "iOS" : /mac os/i.test(agent) ? "macOS" : /linux/i.test(agent) ? "Linux" : "Other";

  return {
    id: visitor.slice(0, 12),
    encryptedIp: await encryptIp(ip, encryptionKey),
    visitedAt: new Date().toISOString(),
    city: cf.city || "Unknown",
    region: cf.region || "Unknown",
    country: cf.country || request.headers.get("CF-IPCountry") || "Unknown",
    timezone: cf.timezone || "Unknown",
    latitude: cf.latitude || null,
    longitude: cf.longitude || null,
    postalCode: cf.postalCode || null,
    colo: cf.colo || null,
    device,
    browser,
    os,
    referrer: referrerHost
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.VIEWS) return json({ error: "VIEWS KV binding is not configured" }, 503);

  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid origin" }, 403);

  const agent = request.headers.get("User-Agent") || "";
  const isBot = /bot|crawler|spider|preview|facebookexternalhit|discordbot/i.test(agent);
  const visitor = await hashVisitor(request, env.VIEW_SALT || new URL(request.url).hostname);
  const visitorKey = `visitor:${visitor}`;
  const alreadyCounted = await env.VIEWS.get(visitorKey);

  let count = Number(await env.VIEWS.get("total")) || 0;
  const writes = [];
  if (!alreadyCounted && !isBot) {
    count += 1;
    writes.push(env.VIEWS.put("total", String(count)), env.VIEWS.put(visitorKey, "1"));
  }

  if (!isBot) {
    const recent = (await env.VIEWS.get("recent", { type: "json" })) || [];
    const cutoff = Date.now() - (30 * 86400 * 1000);
    const retained = recent.filter((item) => Date.parse(item.visitedAt) >= cutoff);
    const previous = retained.find((item) => item.id === visitor.slice(0, 12));
    const encryptionKey = env.IP_ENCRYPTION_KEY || env.ANALYTICS_PASSWORD;
    const current = await describeVisitor(request, visitor, encryptionKey);
    current.firstVisitedAt = previous?.firstVisitedAt || previous?.visitedAt || current.visitedAt;
    current.visits = (previous?.visits || 0) + 1;
    const updated = [current, ...retained.filter((item) => item.id !== current.id)].slice(0, 100);
    writes.push(env.VIEWS.put("recent", JSON.stringify(updated)));
  }

  await Promise.all(writes);

  return json({
    count,
    counted: !alreadyCounted && !isBot,
    diagnostics: {
      ipAvailable: request.headers.has("CF-Connecting-IP"),
      geolocationAvailable: Boolean(request.cf && Object.keys(request.cf).length),
      encryptionAvailable: Boolean(env.IP_ENCRYPTION_KEY || env.ANALYTICS_PASSWORD)
    }
  });
}
