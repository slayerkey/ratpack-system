# CS2 Competitive Dashboard Implementation Plan

## Build strategy

Build Pro first as the complete product target. Build Lite from the same engine as a restricted build flavor.

Do not maintain two independent implementations of Steam discovery, GSI installation, GSI parsing, state storage, rendering, session tracking, settings, or Property Inspector infrastructure.

## Product identities

### Pro

* Product id: `cs2-competitive-dashboard-pro`
* Name: `CS2 Competitive Dashboard Pro`
* Plugin UUID: `com.packrat.cs2-competitive-dashboard-pro`
* Price target: `$9.99`
* First shipping target: yes

### Lite

* Product id: `cs2-competitive-dashboard-lite`
* Name: `CS2 Competitive Dashboard Lite`
* Plugin UUID: `com.packrat.cs2-competitive-dashboard-lite`
* Price: free
* Shipping target: after Pro is stable unless release sequencing changes

Published UUIDs are immutable. Keep the two product namespaces distinct from the existing submitted `CS2` Stream Deck profile product.

## Stream Deck baseline

* SDKVersion: 3
* Plugin runtime: Node.js 20
* Minimum Stream Deck software: 6.9
* OS: Windows 10+
* Application monitoring: `cs2.exe`
* Package and validate with the official Elgato CLI

## Shared engine

One source tree with separate Pro and Lite entry points.

Boundaries:

* `src/core/` normalized dashboard state, shared store, settings
* `src/gsi/` listener, parser, Steam/CS2 locator, config installer
* `src/session/` session and derived metrics
* `src/render/` deterministic Stream Deck key rendering
* `src/actions/` shared base actions
* `src/providers/` direct external provider clients and types
* `src/plugin-pro.ts` Pro action registration
* `src/plugin-lite.ts` Lite action registration
* `static/ui/` shared Property Inspector
* `scripts/` output assembly, deterministic assets, validation helpers
* `tests/` fixture and unit coverage

Generate two `.sdPlugin` directories from the same source during build.

## GSI installation flow

The user-facing experience should be:

1. Install plugin.
2. Open any dashboard action in Stream Deck.
3. Click `Enable Live CS2 Tracking`.
4. Plugin finds Steam and CS2.
5. Plugin starts a local listener.
6. Plugin writes `gamestate_integration_packrat_cs2.cfg` into the discovered CS2 config directory.
7. Property Inspector reports `Ready` or `Restart CS2 once`.
8. CS2 begins posting supported state to the plugin.

### Automatic Steam / CS2 discovery

Windows discovery order:

1. Steam registry path.
2. Common Steam install locations.
3. Parse `steamapps/libraryfolders.vdf`.
4. Find `appmanifest_730.acf`.
5. Resolve CS2 install directory.
6. Target `<CS2>/game/csgo/cfg`.

If automatic discovery fails, allow a manual CS2 path override in global settings instead of making the user hand-write GSI configuration.

## GSI configuration

Default config requests only normal-player data necessary for the product:

```text
"uri" "http://127.0.0.1:<port>/gsi"
"timeout" "5.0"
"buffer" "0.1"
"throttle" "0.1"
"heartbeat" "10.0"
"auth"
{
    "token" "<random-per-install-token>"
}
"data"
{
    "provider" "1"
    "map" "1"
    "map_round_wins" "1"
    "round" "1"
    "player_id" "1"
    "player_state" "1"
    "player_weapons" "1"
    "player_match_stats" "1"
}
```

Do not request observer-oriented data by default.

## Local listener security

* bind only to `127.0.0.1`
* POST `/gsi` only
* random token generated with cryptographic randomness
* body size limit
* validate JSON
* validate `payload.auth.token`
* validate `provider.appid === 730`
* ignore/reject unrelated requests
* never upload raw GSI payloads

## Shared live state

Normalize GSI into a stable internal model rather than coupling actions to raw payloads.

Minimum normalized fields:

* connection state and last payload time
* game running state
* map name
* map phase
* round number / phase
* CT score
* T score
* player team
* health
* armor
* helmet
* money
* equipment value
* defuse kit when available
* weapons and current weapon
* magazine / reserve ammo when available
* kills
* deaths
* assists
* MVPs
* player score
* current-round kills
* current-round headshot kills
* current-round damage
* normal-player bomb/round state when present

## Derived metrics

Track locally from supported GSI state:

* K/D
* session match count
* session wins / losses
* accumulated damage
* ADR estimate based on completed rounds
* accumulated headshot kills
* HS% estimate

Derived metrics must be regression-tested against deterministic fixture sequences before their labels imply parity with CS2 scoreboard/stat-provider calculations.

## Lite feature policy

Lite exposes only:

* Live Score
* Health
* Money
* Current Map
* CS2 / GSI Status

Do not expose Pro-only metrics in Lite merely because the shared engine calculates them. Lite has no FACEIT or Leetify account setup.

## Pro action families

### Live Metric

Configurable live metric action with options such as score, round/phase, kills, deaths, assists, K/D, derived ADR, derived HS%, health, armor, money, equipment value, weapon, ammo, supported bomb state, map, and team.

### Session Metric

* record
* matches
* K/D
* ADR
* HS%

### Competitive Metric

Leetify-backed and gated by the provider's commercial and attribution requirements:

* Premier rating
* current-map Competitive rank
* best Competitive map rank
* recent result / form
* win rate
* Leetify Rating

### FACEIT Metric

* Elo
* level
* region where useful
* K/D
* HS%
* win rate
* recent record
* recent match

### Status / Setup

Always available. Shows actionable states rather than blank keys.

## Pro profiles

Initial profile targets:

### Standard Competitive Dashboard

15 keys for pre/post-game rank, FACEIT, session, and recent performance.

### Standard Match Dashboard

15 keys optimized for live GSI state.

### XL Dashboard

Expanded competitive + live layout. Prefer one coherent XL dashboard or two purposeful profiles rather than filling 32 keys just because they exist.

## Property Inspector

Use a centralized dark PackRat theme inspired by the existing Better Hotkeys Pro visual language.

The Property Inspector should include:

* action-specific metric configuration
* global live-tracking status
* `Enable Live CS2 Tracking` / repair flow
* Steam profile configuration in Pro
* guided Leetify API key setup in Pro
* guided FACEIT API key setup in Pro
* direct official provider links
* masked key input fields
* key saved / rejected / rate limited / provider offline states
* provider profile links when connected
* useful error copy
* a small PackRat footer link

### Provider setup flow

Pro asks for one Steam profile URL, SteamID64, or vanity name plus the customer's own free provider keys.

#### Leetify

1. Click `Get free key` in the Property Inspector.
2. Open `https://leetify.com/app/developer`.
3. Sign in and copy the developer API key.
4. Paste it into Pro.
5. Save and test.

#### FACEIT

1. Click `Open Developer Portal` in the Property Inspector.
2. Open `https://developers.faceit.com/`.
3. Sign in and create an App in App Studio.
4. Open API Keys and create the appropriate client/distributed-app key.
5. Copy the key into Pro.
6. Save and test.

The PI also links directly to `https://docs.faceit.com/getting-started/authentication/api-keys/`.

### Provider credential policy

PackRat does not operate a shared provider credential or provider gateway for this product.

* customer keys are stored in Stream Deck global plugin settings on that PC
* raw saved keys are never returned to the Property Inspector after save
* key fields are password masked
* Leetify requests go directly to `api-public.cs-prod.leetify.com` over HTTPS
* FACEIT requests go directly to `open.faceit.com` over HTTPS
* customer provider keys are never sent to a PackRat service
* no PackRat FACEIT or Leetify secret is bundled in the plugin
* one customer's quota or key revocation cannot consume or disable another customer's provider allowance

Do not claim encrypted-at-rest storage unless separately implemented and verified.

### Footer link behavior

Data-driven build metadata, not hardcoded per action.

Lite initial target:

`https://marketplace.elgato.com/%40packrat`

Once the Pro Marketplace listing exists, replace the Lite footer URL with the direct Pro listing and change the label to an upgrade CTA without touching individual action code.

Pro footer can continue to point to the PackRat Marketplace creator page.

## Refresh policy

* GSI: event-driven / near real time
* UI redraws: only when displayed state changes
* provider profile: randomized background refresh roughly every 50 to 70 minutes
* recent matches: post-match refresh after 30 seconds plus manual refresh
* provider 429: explicit rate-limited state, no tight retry loop
* Steam identity: infrequent

## Error states

At minimum:

* STEAM NOT CONFIGURED
* ADD API KEY
* API KEY REJECTED
* FACEIT NOT FOUND
* LEETIFY PROFILE REQUIRED
* PROFILE PRIVATE
* CS2 CLOSED
* ENABLE LIVE
* WAITING FOR CS2
* GSI LOST
* API OFFLINE
* RATE LIMITED
* UNRANKED
* NO RANK
* NO MATCHES
* LOADING

Never render a blank key for a known setup/data problem.

## Fixture test matrix

### Accounts / providers

* Premier ranked
* Competitive map ranked
* unranked
* FACEIT account
* no FACEIT account
* no Leetify account
* private profile
* no recent matches
* missing Leetify key
* missing FACEIT key
* rejected Leetify key
* rejected FACEIT key
* provider 429
* provider 5xx / offline

### GSI

* CS2 menu
* match load
* round start
* damage
* money change
* weapon change
* kill
* headshot kill
* death
* bomb planted state if emitted
* round end
* halftime / side change where detectable
* match win
* match loss
* disconnect / reconnect
* malformed payload
* wrong token
* wrong app id

### Derived metrics

Known input sequences must assert exact expected K/D, accumulated damage, ADR calculation, headshot percentage, and session W/L.

## Release gates

Before release candidate:

1. Source and unit/fixture tests pass.
2. Both build flavors compile from one source tree.
3. Manifest validation passes.
4. Official Elgato CLI validation passes.
5. Official `.streamDeckPlugin` packages are generated.
6. Property Inspector is verified for provider setup and all setup/error states.
7. GSI config generation is fixture-tested across standard and custom Steam libraries.
8. Real normal-player GSI spike is captured and compared to fixtures.
9. Real customer-owned Leetify and FACEIT keys are exercised through the Property Inspector.
10. Leetify commercial/attribution requirements are cleared for the paid features included in the listing.
11. Official unmodified Leetify attribution artwork is packaged.
12. Physical Stream Deck validation is performed where actual hardware behavior matters.
