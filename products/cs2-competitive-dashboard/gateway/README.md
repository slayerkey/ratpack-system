# RatPack CS2 Provider Gateway

Stateless server-side adapter used only by CS2 Competitive Dashboard Pro for online profile/rank sources.

## Contract

- `GET /health`
- `GET /v1/cs2/profile?steam=<SteamID64 | Steam profile URL | vanity>`
- fixed upstreams only: Steam, Leetify, FACEIT
- no GSI endpoint
- no KV, D1, R2, cache, Durable Object, or other persistence binding
- every response uses `Cache-Control: no-store`
- provider keys are Worker secrets, never plugin settings

## Required secrets

Set with Wrangler or the Cloudflare dashboard. Never commit values.

- `FACEIT_API_KEY`: FACEIT App Studio server-side Data API key.
- `STEAM_WEB_API_KEY`: needed only to resolve vanity Steam URLs. Numeric SteamID64 and `/profiles/<id>` URLs do not need it.
- `LEETIFY_API_KEY`: recommended production developer key. The gateway can make the public request without it, but production should use the approved developer integration and published attribution requirements.

Example secret setup:

```text
npx wrangler secret put FACEIT_API_KEY
npx wrangler secret put STEAM_WEB_API_KEY
npx wrangler secret put LEETIFY_API_KEY
```

## Local checks

```text
npm test
node --check src/worker.mjs
```

## Deploy

```text
npx wrangler deploy
```

After deployment and provider release clearance, set the resulting HTTPS origin in `plugin/src/providers/config.ts` as `PRO_GATEWAY_BASE_URL`, rebuild, rerun CI, and package again.

## Privacy

The Worker transforms current provider responses in memory and returns the normalized fields required by the plugin. It does not write provider responses to storage. Do not add persistent caching for Leetify data without re-evaluating Leetify's current developer rules.
