const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function passwordMatches(actual, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.ANALYTICS_PASSWORD) return json({ error: "ANALYTICS_PASSWORD is not configured" }, 503);

  let submitted = "";
  try { submitted = (await request.json()).password || ""; } catch {}
  if (!await passwordMatches(submitted, env.ANALYTICS_PASSWORD)) return json({ error: "Invalid password" }, 401);

  const [count, visitors] = await Promise.all([
    env.VIEWS.get("total"),
    env.VIEWS.get("recent", { type: "json" })
  ]);
  return json({ count: Number(count) || 0, visitors: visitors || [] });
}
