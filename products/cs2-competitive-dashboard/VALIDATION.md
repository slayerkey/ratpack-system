# CS2 Competitive Dashboard Validation

## Verdict

BUILD WITH CHANGES

The original universal CS2 live rank tracker is not viable as a direct Valve data product because the public Steam Web API does not expose Premier CS Rating, map-specific Competitive ranks, or modern CS2 matchmaking history.

The stronger product is a CS2 Competitive Dashboard built around three data layers:

1. Valve CS2 Game State Integration for local live match state.
2. FACEIT's official Data API for optional FACEIT account and match data.
3. Leetify's official Public CS API for Premier and map-specific Competitive rank data when the player is registered with Leetify and the commercial-use gate is cleared.

## Product names

* Paid: CS2 Competitive Dashboard Pro
* Free: CS2 Competitive Dashboard Lite

## Positioning

A physical CS2 competitive dashboard for Stream Deck that covers the player lifecycle before, during, and after a match.

### Pre-game

* Premier rating when Leetify is available
* Competitive map ranks when Leetify is available
* FACEIT Elo and level
* Recent performance
* Session state

### In-game

* Score
* Round / phase
* Local-player kills, deaths, assists, K/D
* Health and armor
* Money and equipment value
* Current weapon and ammo
* Map and team
* Basic bomb / round state where normal-player GSI exposes it
* Derived session metrics

### Post-game

* Match result
* Session wins and losses
* Session performance
* Refreshed external account data when the upstream provider has processed the match

## Data feasibility

### Valve Steam Web API

Recommended for identity only. Do not depend on it for Premier, map-specific Competitive ranks, or CS2 matchmaking history.

SteamID64 values are accepted directly. Steam vanity/profile URLs can be resolved without a Steam Web API key through the public Steam Community profile representation already used by the plugin.

### CS2 Game State Integration

Core product dependency and strongest technical foundation.

Use the normal local-player GSI components only by default:

* provider
* map
* map_round_wins
* round
* player_id
* player_state
* player_weapons
* player_match_stats

Do not design the normal-player product around observer-only / spectator-oriented components such as phase_countdowns, allplayers_*, allgrenades, the richer bomb object, or player_position.

The product must not claim an exact bomb timer or exact round countdown unless Valve later exposes those values to a normal player through supported GSI.

### FACEIT

Official Data API is a strong optional Pro integration for:

* Elo
* skill level
* region
* match history
* match results
* lifetime statistics
* recent form

Final customer architecture uses the **customer's own free FACEIT developer API key**. PackRat does not ship or operate a shared FACEIT credential.

The Property Inspector guides the user directly to:

* Developer Portal: `https://developers.faceit.com/`
* Official key guide: `https://docs.faceit.com/getting-started/authentication/api-keys/`

The intended setup is: sign in, create an App in App Studio, create a suitable client/distributed-app API key, paste it into Pro, then save/test. The plugin auto-resolves the matching FACEIT CS2 account from the configured Steam identity.

FACEIT documents HTTP 429 for the Data API but does not publish a numeric standard Data API quota. With customer-owned keys, rate-limit impact is isolated to the customer rather than shared across the PackRat install base.

### Leetify

Official Public CS API can provide the key Valve-matchmaking data the Steam Web API does not provide, including Premier and map-specific Competitive ranks for registered Leetify users.

Final customer architecture uses the **customer's own free Leetify developer API key** from:

`https://leetify.com/app/developer`

The user signs into Leetify, opens the developer page, copies their key, and pastes it into Pro. The plugin calls Leetify directly over HTTPS.

Customer ownership of the key does not remove Leetify's integration requirements. Paid release of Leetify-backed features is still gated on the applicable commercial-use rules, required attribution/linkback presentation, and the official unmodified `Data Provided by Leetify` asset.

Do not persist returned Leetify profile data. Current implementation keeps provider responses in memory only; the customer's API key itself is saved as plugin configuration.

## Provider credential architecture

There is no PackRat provider gateway in the shipping design.

Customer path:

Stream Deck plugin backend -> Leetify / FACEIT official HTTPS API

Requirements:

* never bundle a PackRat FACEIT or Leetify secret
* never send customer provider keys to a PackRat service
* store only the customer's configured keys in Stream Deck global plugin settings
* never return raw saved keys back to the Property Inspector after save
* mask key inputs in the Property Inspector
* expose direct official provider setup links
* provide clear missing-key, invalid-key, rate-limit, profile-not-found, private, and offline states
* keep background profile refresh conservative

This architecture removes PackRat-wide provider quota exhaustion and provider key rotation as product operations concerns.

## GSI safety boundary

RatPack must only consume data CS2 deliberately sends through Game State Integration.

Do not:

* inject into CS2
* read game memory
* hook the process
* scrape the screen to recover hidden state
* automate gameplay input
* circumvent the distinction between normal-player and observer GSI payloads

Tournament and league rules may be stricter than normal matchmaking rules, so documentation should tell competitive event players to verify the event's third-party-software policy.

## Privacy and security

The live telemetry path must remain local:

CS2 -> 127.0.0.1 -> RatPack Stream Deck plugin -> Stream Deck

Requirements:

* bind the GSI HTTP server to 127.0.0.1 only
* accept POST only on the expected GSI route
* generate a per-install random auth token
* validate payload token and CS2 app id 730
* enforce a small request body limit
* reject malformed JSON
* do not upload raw GSI gameplay telemetry

External provider requests are a separate path and must never receive GSI payloads.

## Platform support

V1: Windows only.

Reasoning:

* CS2 is meaningfully supported on Windows and Linux, not current native macOS.
* Stream Deck desktop is officially supported on Windows and macOS, not Linux.
* The practical overlap for the complete product is Windows.

## Lite scope

Free and deliberately small:

1. Live Score
2. Health
3. Money
4. Current Map
5. CS2 / GSI Status

Lite exists to demonstrate the core magic of a live CS2-aware Stream Deck without giving away the competitive analytics product. Lite has no Leetify or FACEIT key setup.

## Pro scope

Pro is the full product and the first shipping target.

Pro families:

* full normal-player live GSI metrics
* session analytics
* Premier and Competitive ranks through customer-configured Leetify
* FACEIT account and match data through customer-configured FACEIT
* recent matches and form
* prebuilt Standard and XL dashboards
* guided Property Inspector setup and customization

## Pricing

* Lite: free
* Pro launch: $9.99 one-time
* Revisit $12.99 after the product is proven and the final feature/visual quality justifies it

## Opportunity

* Opportunity score: 86 / 100
* Confidence: 90 / 100
* Development difficulty: 7 / 10
* Maintenance risk: 6 / 10

## Principal risks

1. Leetify commercial-use and attribution rules.
2. External API schema changes.
3. Customer confusion during provider developer-key setup.
4. Incorrectly assuming observer GSI fields are available to normal players.
5. GSI install-path edge cases across custom Steam libraries.
6. Maintaining a clean Lite/Pro split without duplicating the engine.

## Required technical spike before release candidate

Capture real normal-player CS2 GSI payloads for at least:

* menu / map load
* round start
* player damage
* money change
* weapon change
* kill
* death
* bomb planted state if emitted in normal payload
* round end
* match end
* CS2 exit and reconnect

The implementation should use fixture recordings so normal development and regression testing do not require playing a live match every iteration.
