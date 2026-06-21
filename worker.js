import { onRequest as handleViews } from "./functions/api/views.js";
import { onRequest as handleAnalytics } from "./functions/api/analytics.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/views") {
      return handleViews({ request, env });
    }

    if (url.pathname === "/api/analytics") {
      return handleAnalytics({ request, env });
    }

    if (url.pathname === "/analytics") {
      return Response.redirect(`${url.origin}/analytics.html`, 302);
    }

    return env.ASSETS.fetch(request);
  }
};
