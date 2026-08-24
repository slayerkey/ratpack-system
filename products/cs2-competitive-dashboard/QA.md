# CS2 Competitive Dashboard QA

Date: 2026-08-24

## Automated release evidence

The shared Pro/Lite source has passed clean GitHub Actions validation on Windows and Linux on prior release-candidate commits.

Automated checks cover:

* TypeScript typecheck
* CS2 normal-player GSI normalization fixtures
* App ID 730 rejection for non-CS2 payloads
* localhost-only authenticated GSI listener behavior
* Steam library and custom-library discovery fixtures
* atomic GSI configuration generation
* session K/D, derived ADR, HS%, match finalization, and W/L fixtures
* online provider client success/error fixtures
* Competitive/Premier and FACEIT key-format fixtures
* stateless gateway identity/provider/error fixtures
* keyless Steam vanity/profile resolution through Steam Community XML
* no-open-proxy gateway test
* no-store gateway response policy
* production dependency audit at high severity
* exact Pro action-surface policy
* exact Lite action/metric ceiling policy
* provider-secret exclusion from packaged plugins
* official Leetify attribution fail-closed policy before a production gateway may be enabled
* conservative provider refresh jitter tests
* both Pro and Lite builds
* official Elgato CLI validation
* official `.streamDeckPlugin` packaging

Expected packaged action surfaces:

### Pro

* Live Metric
* Session Metric
* Competitive Metric
* FACEIT Metric
* CS2 Status

### Lite

* Live Metric
* CS2 Status

Lite Live Metric is restricted to Score, Health, Money, and Map.

## Provider architecture QA

The online gateway is deliberately stateless.

* fixed Steam Community, Leetify, and FACEIT upstreams only
* no arbitrary proxy target
* no GSI endpoint
* no KV, D1, R2, Durable Object, database, or persistent cache binding
* provider secrets remain server-side
* customers never create or paste API keys
* Steam identity resolution does not require a Steam Web API key
* one PackRat-owned FACEIT application key services installs through the gateway
* Leetify does not require an API key for minimum deployment; an optional PackRat-owned key can be added later if production traffic needs a higher allowance
* response header is `Cache-Control: no-store`
* normalized data only is returned to the plugin
* Leetify `not found`, private, rate-limit, unavailable, and offline states remain explicit
* FACEIT `not found`, rate-limit, unavailable, and offline states remain explicit

### Provider traffic / rate-limit strategy

FACEIT's current public Data API documentation explicitly lists HTTP 429 but does not publish a numeric Data API quota. Do not assume rate numbers from FACEIT partner/CDP APIs apply to this product.

The plugin therefore treats online profile data as slow-changing data rather than live telemetry:

* normal background refresh is selected once per process inside a 50 to 70 minute jitter window
* manual refresh remains immediate
* completing a local CS2 match schedules one immediate provider refresh after 30 seconds
* each full refresh currently uses one Leetify profile request and up to three FACEIT Data API requests
* installs are jittered to avoid synchronized marketplace-wide refresh spikes
* a FACEIT 429 is rendered as an explicit rate-limited source state rather than silently retrying in a tight loop

Background-only FACEIT load is approximately three requests per configured always-on install per hour. That is about 0.83 requests/second averaged across 1,000 always-on installs, or about 8.3 requests/second across 10,000 always-on installs, before manual or post-match refreshes. These figures describe our request rate, not a claimed FACEIT allowance.

If real production telemetry shows sustained 429s, the first response is to reduce background cadence further and request/confirm a production quota with FACEIT. Requiring every customer to create a developer App/API key is a fallback, not the default UX.

## Rat Dev local install

Development testing should not use ZIP downloads.

The product branch contains a Rat Dev registration and build shim. With the current RatPack `main`, the intended local workflow is:

```text
rat main
rat dev cs2-competitive-dashboard
```

Rat Dev fetches `origin/product/cs2-competitive-dashboard`, builds and tests the Pro flavor, runs the official Stream Deck CLI validator, links the generated Pro `.sdPlugin` into Stream Deck developer mode, and restarts it. Development output stays under `out\dev`.

## Release blockers that require external state

These are not ordinary code or packaging failures and cannot be truthfully simulated in CI.

1. **Official Leetify attribution asset**
   * Obtain Leetify's unmodified primary dark-background `Data Provided by Leetify` asset from the asset folder linked by Leetify's developer guidelines.
   * Commit it exactly as `plugin/static/ui/leetify-provided-dark.svg`.
   * Do not redraw, trace, recolor, or recreate it.

2. **PackRat provider / Cloudflare credentials**
   * `CLOUDFLARE_API_TOKEN`
   * `CLOUDFLARE_ACCOUNT_ID`
   * `FACEIT_API_KEY`
   * Optional `LEETIFY_API_KEY` only if production traffic later needs it
   * These are created once for PackRat infrastructure. Customers do not need them.
   * Store them as GitHub environment/repository secrets, never in source.

3. **Production provider deployment**
   * Run `.github/workflows/cs2-gateway-deploy.yml` manually after #1 and #2.
   * The workflow reruns gateway tests, refuses to deploy without the official Leetify attribution file, deploys through Wrangler, and verifies `/health`.
   * Wire the resulting HTTPS origin with `npm run set-gateway -- https://<worker-origin>` from the plugin directory.
   * That command also replaces the temporary text attribution with the official logo element and refuses to run if the logo file is missing.
   * Rerun the full product CI after wiring.

4. **Real normal-player CS2 smoke test**
   * Install/update Pro through `rat dev cs2-competitive-dashboard` on Windows.
   * Open its Property Inspector and press `Enable Live CS2 Tracking`.
   * Confirm automatic Steam/App 730 discovery or use the path override only if needed.
   * Launch/restart CS2 as a normal player, not GOTV/observer.
   * Verify live Score, Health, Money, Map, weapon/ammo, and player stat updates.
   * Verify no exact timer is claimed from observer-only data.
   * Complete a match and verify W/L increments once and session metrics remain coherent.

5. **Physical Stream Deck smoke test**
   * Add all five Pro action families to keys.
   * Confirm readable rendering, prompt key refresh, Property Inspector settings persistence, Stream Deck restart persistence, and clean error states with CS2 closed/provider unavailable.

## Smallest final manual test

Once the provider deployment is wired, the minimum final host/device validation is:

1. run `rat main`
2. run `rat dev cs2-competitive-dashboard`
3. enable GSI
4. launch CS2 and play/enter a normal match
5. confirm at least one Live, Session, Competitive, and FACEIT key
6. close/reopen Stream Deck and CS2
7. confirm settings and data recovery

Everything before that boundary should remain automated.
