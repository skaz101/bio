import { onRequest as handleViews } from "./functions/api/views.js";
import { onRequest as handleAnalytics } from "./functions/api/analytics.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const protectedRoute = url.pathname === "/analytics" || url.pathname === "/analytics.html" || url.pathname.startsWith("/api/");
    let visitorScheme = "";
    try { visitorScheme = JSON.parse(request.headers.get("CF-Visitor") || "{}").scheme || ""; } catch {}

    if (protectedRoute && visitorScheme === "http") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/views") {
      return handleViews({ request, env });
    }

    if (url.pathname === "/api/analytics") {
      return handleAnalytics({ request, env });
    }

    return env.ASSETS.fetch(request);
  }
};
