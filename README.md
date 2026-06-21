# bio

## Cloudflare Worker deployment

The site deploys as a Cloudflare Worker with static assets. Use these Git build settings:

- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

The `VIEWS` KV binding in `wrangler.jsonc` is created automatically during deployment. The `/api/views` endpoint records one view per IP/device combination every 24 hours and stores a SHA-256 visitor hash rather than the raw IP address.

Optionally add an encrypted runtime variable named `VIEW_SALT` under **Settings > Variables and Secrets** for stronger visitor hashing.

### Private visitor analytics

Add an encrypted runtime secret named `ANALYTICS_PASSWORD` under **Settings > Variables and Secrets**, then redeploy. Visit `/analytics` and enter that password to see the latest 100 unique daily visitors with approximate city, region, country, device, browser, referrer, and visit time. Raw IP addresses are never stored.
