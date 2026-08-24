# RatPack CS2 Provider Gateway

Stateless server-side adapter used only by CS2 Competitive Dashboard Pro for online profile/rank sources.

## Customer experience

Customers do **not** create or paste API keys.

They provide one Steam profile URL, SteamID64, or vanity name in the plugin. The RatPack gateway resolves that identity and queries the supported providers. Any provider credentials belong to the PackRat service and remain server-side.

## Contract

- `GET /health`
- `GET /v1/cs2/profile?steam=<SteamID64 | Steam profile URL | vanity>`
- fixed upstreams only: Steam Community profile XML, Leetify, FACEIT
- no GSI endpoint
- no KV, D1, R2, cache, Durable Object, or other persistence binding
- every response uses `Cache-Control: no-store`
- provider keys are Worker secrets, never plugin settings

## Provider credentials

### FACEIT

`FACEIT_API_KEY` is the **only mandatory provider API key** for the current full Pro feature set. Create one PackRat-owned server-side Data API key in FACEIT App Studio. FACEIT documents Data API access as programmatic application access, and server-side keys are specifically intended to stay on the app server rather than being shared with clients/users.

### Leetify

No Leetify key is required to deploy or use the integration. Leetify's public API currently permits anonymous requests with stricter rate limits.

A PackRat-owned `LEETIFY_API_KEY` can be added later if real production traffic needs the higher authenticated allowance. Whether authenticated or anonymous, Leetify-sourced values still require Leetify's official unmodified `Data Provided by Leetify` attribution and `View on Leetify` link.

### Steam

No Steam Web API key is required. Numeric SteamID64 and `/profiles/<id>` URLs resolve locally. Vanity profile URLs resolve through Steam Community's public `?xml=1` profile representation and extract only `steamID64`.

## Cloudflare deployment credentials

The deployment workflow itself needs PackRat's Cloudflare credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

These are infrastructure credentials, not customer-facing product setup.

## Minimum secret setup

Required for the current full FACEIT feature set:

```text
npx wrangler secret put FACEIT_API_KEY
```

Optional later, only if Leetify traffic needs higher limits:

```text
npx wrangler secret put LEETIFY_API_KEY
```

Never commit the values.

## Local checks

```text
npm test
node --check src/worker.mjs
```

## Deploy

```text
npx wrangler deploy
```

After deployment and provider release clearance, run the guarded plugin helper with the resulting HTTPS origin, rebuild, rerun CI, and package again.

## Privacy

The Worker transforms current provider responses in memory and returns the normalized fields required by the plugin. It does not write provider responses to storage. Do not add persistent caching for Leetify data without re-evaluating Leetify's current developer rules.
