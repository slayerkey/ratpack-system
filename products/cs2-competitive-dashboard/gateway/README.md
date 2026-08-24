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

`FACEIT_API_KEY` is required for FACEIT metrics. Create **one PackRat-owned server-side Data API key** in FACEIT App Studio. FACEIT documents Data API keys as application credentials used programmatically, not credentials every end user must create.

### Leetify

`LEETIFY_API_KEY` is recommended for production reliability and rate limits, but the public API currently accepts requests without a key. Whether authenticated or anonymous, Leetify-sourced values still require Leetify's published `Data Provided by Leetify` attribution and `View on Leetify` link.

The production release should use a PackRat-owned Leetify developer key rather than asking customers for theirs.

### Steam

No Steam Web API key is required. Numeric SteamID64 and `/profiles/<id>` URLs resolve locally. Vanity profile URLs resolve through Steam Community's public `?xml=1` profile representation and extract only `steamID64`.

## Cloudflare deployment credentials

The deployment workflow itself needs PackRat's Cloudflare credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

These are infrastructure credentials, not customer-facing product setup.

## Secret setup

Required for full FACEIT support:

```text
npx wrangler secret put FACEIT_API_KEY
```

Recommended for production Leetify traffic:

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
