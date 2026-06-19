# bio

## Cloudflare view counter

The `/api/views` Pages Function records one view per IP/device combination every 24 hours. It stores a SHA-256 visitor hash, not the raw IP address.

In the Cloudflare dashboard:

1. Open **Storage & Databases > KV** and create a namespace named `bio-views`.
2. Open this Pages project, then **Settings > Bindings > Add > KV namespace**.
3. Set the variable name to `VIEWS` and select `bio-views`.
4. Optional: add an encrypted environment variable named `VIEW_SALT` with a long random value.
5. Redeploy the latest Pages deployment so the binding becomes active.
