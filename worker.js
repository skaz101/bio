import { onRequest as handleViews } from "./functions/api/views.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/views") {
      return handleViews({ request, env });
    }

    return env.ASSETS.fetch(request);
  }
};
