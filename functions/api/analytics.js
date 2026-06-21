const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};
const ANALYTICS_VERSION = "1.1.0";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function passwordMatches(actual, expected) {
  const encoder = new TextEncoder();
  const normalize = (value) => String(value).normalize("NFKC").trim();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(normalize(actual))),
    crypto.subtle.digest("SHA-256", encoder.encode(normalize(expected)))
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function requestFingerprint(request) {
  const value = `${request.headers.get("CF-Connecting-IP") || "unknown"}:${request.headers.get("User-Agent") || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function decryptIp(value, secret) {
  if (!value || !secret) return "Not recorded";
  try {
    const packed = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    const iv = packed.slice(0, 12), encrypted = packed.slice(12);
    const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch { return "Unavailable"; }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.ANALYTICS_PASSWORD) return json({ error: "ANALYTICS_PASSWORD is not configured" }, 503);

  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid origin" }, 403);

  const attemptKey = `analytics-auth:${await requestFingerprint(request)}`;
  const failures = Number(await env.VIEWS.get(attemptKey)) || 0;
  if (failures >= 5) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);

  let submitted = "";
  try { submitted = (await request.json()).password || ""; } catch {}
  if (!await passwordMatches(submitted, env.ANALYTICS_PASSWORD)) {
    await env.VIEWS.put(attemptKey, String(failures + 1), { expirationTtl: 900 });
    return json({ error: "Invalid password" }, 401);
  }

  await env.VIEWS.delete(attemptKey);

  const [count, visitors] = await Promise.all([
    env.VIEWS.get("total"),
    env.VIEWS.get("recent", { type: "json" })
  ]);
  const cutoff = Date.now() - (30 * 86400 * 1000);
  const decrypted = await Promise.all((visitors || []).filter((visitor) => Date.parse(visitor.visitedAt) >= cutoff).map(async (visitor) => {
    const { encryptedIp, ...safeVisitor } = visitor;
    return { ...safeVisitor, ip: await decryptIp(encryptedIp, env.IP_ENCRYPTION_KEY) };
  }));
  return json({ version: ANALYTICS_VERSION, count: Number(count) || 0, visitors: decrypted });
}
