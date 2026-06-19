const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function hashVisitor(request, salt) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const agent = request.headers.get("User-Agent") || "unknown";
  const bytes = new TextEncoder().encode(`${salt}:${ip}:${agent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
  if (!alreadyCounted && !isBot) {
    count += 1;
    await Promise.all([
      env.VIEWS.put("total", String(count)),
      env.VIEWS.put(visitorKey, "1", { expirationTtl: 86400 })
    ]);
  }

  return json({ count, counted: !alreadyCounted && !isBot });
}
