# CS2 Competitive Dashboard QA

Date: 2026-08-24

## Automated release evidence

The shared Pro/Lite source is current with RatPack `main` and the customer-owned provider-key architecture has now passed a clean GitHub Actions release gate after the repository became public. The latest successful run includes TypeScript, provider fixtures, dependency audit, Pro/Lite builds, official Elgato validation, packaging, and the Rat Dev registration path.

Automated checks cover:

* TypeScript typecheck
* CS2 normal-player GSI normalization fixtures
* App ID 730 rejection for non-CS2 payloads
* localhost-only authenticated GSI listener behavior
* Steam library and custom-library discovery fixtures
* atomic GSI configuration generation
* session K/D, derived ADR, HS%, match finalization, and W/L fixtures
* keyless Steam vanity/profile resolution through Steam Community XML
* direct Leetify provider normalization using a customer key fixture
* direct FACEIT provider normalization using a customer key fixture
* missing provider-key states
* rejected provider-key states
* provider rate-limit states
* production dependency audit at high severity
* exact Pro action-surface policy
* exact Lite action/metric ceiling policy
* no bundled PackRat provider credentials
* direct official provider setup links in the Property Inspector
* masked provider key inputs
* conservative provider refresh jitter tests
* both Pro and Lite builds
* official Elgato CLI validation
* official `.streamDeckPlugin` packaging
* Rat Dev Pro build registration

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

There is no shared PackRat FACEIT or Leetify provider gateway in the final architecture.

Pro uses customer-owned provider keys:

* Leetify API key from `https://leetify.com/app/developer`
* FACEIT API key created through `https://developers.faceit.com/`
* official FACEIT key instructions at `https://docs.faceit.com/getting-started/authentication/api-keys/`

Expected provider path:

Stream Deck plugin backend -> official provider HTTPS API

Requirements:

* provider keys are saved in Stream Deck global plugin settings on the user's PC
* raw saved keys are never returned to the Property Inspector after save
* key input fields use password masking
* no customer provider key is sent to a PackRat service
* no PackRat provider secret is bundled in Pro or Lite
* Steam identity resolution does not require a Steam Web API key
* Leetify `not configured`, rejected-key, not-found, private, rate-limit, unavailable, and offline states remain explicit
* FACEIT `not configured`, rejected-key, not-found, private, rate-limit, unavailable, and offline states remain explicit
* one customer's provider rate limit cannot consume another customer's API allowance through a shared PackRat key

### Provider refresh strategy

Online rank/profile data is slow-changing data, not live telemetry.

* normal background refresh is selected once per process inside a 50 to 70 minute jitter window
* manual refresh remains immediate
* completing a local CS2 match schedules one provider refresh after 30 seconds
* each full configured refresh currently uses one Leetify profile request and up to three FACEIT Data API requests
* provider 429 responses render an explicit `rate_limited` state rather than tight retrying

Since each install uses its own provider keys, this cadence is per-customer rather than an aggregate PackRat quota.

## Provider setup UX QA

The Pro Property Inspector must make provider setup understandable without outside documentation searches.

### Leetify

1. Show a direct **Get free key** action.
2. Open `https://leetify.com/app/developer`.
3. Explain: sign in, open Developer API page, copy key, paste key.
4. Save without echoing the stored key back into the input.
5. Show `Key saved`, `Connected`, `Key rejected`, or provider error state.
6. Provide a Remove action.

### FACEIT

1. Show a direct **Open Developer Portal** action.
2. Open `https://developers.faceit.com/`.
3. Explain: sign in, create an App in App Studio, open API Keys, create the appropriate client/distributed-app key, copy it, paste it.
4. Link the official FACEIT API key guide directly.
5. Save without echoing the stored key back into the input.
6. Show `Key saved`, `Connected`, `Key rejected`, or provider error state.
7. Provide a Remove action.

### Disclosure

The PI must state that keys are stored in the plugin's local Stream Deck settings and are sent only to the matching provider API, not to a PackRat server. Do not claim encrypted-at-rest storage unless that is independently implemented and verified.

## Rat Dev local install

Development testing should not use ZIP downloads.

With current RatPack `main`, the intended local workflow is:

```text
rat main
rat dev cs2-competitive-dashboard
```

Rat Dev fetches `origin/product/cs2-competitive-dashboard`, builds and tests the Pro flavor, runs the official Stream Deck CLI validator, links the generated Pro `.sdPlugin` into Stream Deck developer mode, and restarts it. Development output stays under `out\dev`.

## Release blockers that require external state

These are not ordinary implementation tasks and cannot be truthfully simulated in CI.

1. **Leetify commercial / attribution clearance**
   * Confirm the final paid Marketplace use remains consistent with Leetify's current developer rules.
   * Obtain Leetify's official unmodified dark-background `Data Provided by Leetify` asset from the asset folder linked by Leetify's developer guidelines.
   * Commit/package the official asset rather than redrawing or tracing it.
   * Preserve `View on Leetify` linkback.

2. **Real customer-key provider smoke test**
   * Use a real Leetify developer key created from the user-facing developer page.
   * Use a real FACEIT App/API key created through the user-facing Developer Portal.
   * Save both through the Property Inspector.
   * Confirm neither raw key is redisplayed after save.
   * Confirm Leetify Premier/map data and FACEIT Elo/level data load for the configured Steam account.
   * Confirm invalid-key and Remove flows.

3. **Real normal-player CS2 smoke test**
   * Install/update Pro through `rat dev cs2-competitive-dashboard` on Windows.
   * Open its Property Inspector and press `Enable Live CS2 Tracking`.
   * Confirm automatic Steam/App 730 discovery or use the path override only if needed.
   * Launch/restart CS2 as a normal player, not GOTV/observer.
   * Verify live Score, Health, Money, Map, weapon/ammo, and player stat updates.
   * Verify no exact timer is claimed from observer-only data.
   * Complete a match and verify W/L increments once and session metrics remain coherent.

4. **Physical Stream Deck smoke test**
   * Add all five Pro action families to keys.
   * Confirm readable rendering, prompt key refresh, Property Inspector settings persistence, Stream Deck restart persistence, and clean error states with CS2 closed/provider unavailable.

## Smallest final manual test

1. run `rat main`
2. run `rat dev cs2-competitive-dashboard`
3. enable GSI
4. save a Steam profile, Leetify key, and FACEIT key
5. confirm one Competitive and one FACEIT key load real data
6. launch CS2 and enter a normal match
7. confirm Live and Session keys update
8. close/reopen Stream Deck and CS2
9. confirm settings and data recovery

Everything before that boundary should remain automated.
