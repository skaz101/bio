# bio

## Cloudflare Worker deployment

The site deploys as a Cloudflare Worker with static assets. Use these Git build settings:

- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

The `VIEWS` KV binding in `wrangler.jsonc` is created automatically during deployment. The `/api/views` endpoint records one view per IP/device combination every 24 hours and stores a SHA-256 visitor hash rather than the raw IP address.

Optionally add an encrypted runtime variable named `VIEW_SALT` under **Settings > Variables and Secrets** for stronger visitor hashing.

### Private visitor analytics

Add two encrypted runtime secrets under **Settings > Variables and Secrets**, then redeploy:

- `ANALYTICS_PASSWORD`: a strong password used to open the dashboard.
- `IP_ENCRYPTION_KEY`: a separate long random value used to encrypt visitor IP addresses in KV.

Visit `/analytics` and enter the analytics password to see the latest 100 unique daily visitors with approximate city, region, country, IP address, device, browser, referrer, and visit time. IP addresses are encrypted with AES-GCM at rest, decrypted only after authentication, and retained for at most 30 days. Failed login attempts are limited to five per device every 15 minutes.
