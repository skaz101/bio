# bio

## Cloudflare Worker deployment

The site deploys as a Cloudflare Worker with static assets. Use these Git build settings:

- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

The `VIEWS` KV binding in `wrangler.jsonc` is created automatically during deployment. The `/api/views` endpoint counts each hashed IP address once without expiration. Return visits update analytics activity and last-seen time without increasing the public total.

Optionally add an encrypted runtime variable named `VIEW_SALT` under **Settings > Variables and Secrets** for stronger visitor hashing.

### Private visitor analytics

Add two encrypted runtime secrets under **Settings > Variables and Secrets**, then redeploy:

- `ANALYTICS_PASSWORD`: a strong password used to open the dashboard.
- `IP_ENCRYPTION_KEY`: a separate long random value used to encrypt visitor IP addresses in KV.

Visit `/analytics` and enter the analytics password to see the latest 100 unique IPs with approximate city, region, country, IP address, device, browser, referrer, visit frequency, and last-seen time. IP addresses are encrypted with AES-GCM at rest, decrypted only after authentication, and recent activity is retained for at most 30 days.

The analytics page and API enforce HTTPS. Neither secret is committed to the repository or sent to site visitors.
