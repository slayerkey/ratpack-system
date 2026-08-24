# CS2 Competitive Dashboard Validation

## Verdict

BUILD WITH CHANGES

The original universal CS2 live rank tracker is not viable as a direct Valve data product because the public Steam Web API does not expose Premier CS Rating, map-specific Competitive ranks, or modern CS2 matchmaking history.

The stronger product is a CS2 Competitive Dashboard built around three data layers:

1. Valve CS2 Game State Integration for local live match state.
2. FACEIT's official Data API for optional FACEIT account and match data.
3. Leetify's official Public CS API for Premier and map-specific Competitive rank data when the player is registered with Leetify and the commercial-use gate is cleared.

## Product names

- Paid: CS2 Competitive Dashboard Pro
- Free: CS2 Competitive Dashboard Lite

## Positioning

A physical CS2 competitive dashboard for Stream Deck that covers the player lifecycle before, during, and after a match.

### Pre-game

- Premier rating when Leetify is available
- Competitive map ranks when Leetify is available
- FACEIT Elo and level
- Recent performance
- Session state

### In-game

- Score
- Round / phase
- Local-player kills, deaths, assists, K/D
- Health and armor
- Money and equipment value
- Current weapon and ammo
- Map and team
- Basic bomb / round state where normal-player GSI exposes it
- Derived session metrics

### Post-game

- Match result
- Session wins and losses
- Session performance
- Refreshed external account data when the upstream provider has processed the match

## Data feasibility

### Valve Steam Web API

Recommended for identity and account resolution only. Do not depend on it for Premier, map-specific Competitive ranks, or CS2 matchmaking match history.

### CS2 Game State Integration

Core product dependency and strongest technical foundation.

Use the normal local-player GSI components only by default:

- provider
- map
- map_round_wins
- round
- player_id
- player_state
- player_weapons
- player_match_stats

Do not design the normal-player product around observer-only / spectator-oriented components such as phase_countdowns, allplayers_*, allgrenades, the richer bomb object, or player_position.

The product must not claim an exact bomb timer or exact round countdown unless Valve later exposes those values to a normal player through supported GSI.

### FACEIT

Official Data API is a strong optional integration for:

- Elo
- skill level
- region
- match history
- match results
- lifetime and match statistics
- map data

Customer-facing setup should not require a FACEIT developer key. RatPack should own the integration and auto-detect the user's FACEIT identity from the configured Steam account where possible.

### Leetify

Official Public CS API can provide the key Valve-matchmaking data the Steam Web API does not provide, including Premier and map-specific Competitive ranks for registered Leetify users.

Commercial release of paid Leetify-powered features is gated on explicit clarification of:

1. Paid Elgato Marketplace distribution.
2. API key architecture for installed users.
3. Temporary/in-memory caching rules.
4. Whether a session-start rank baseline may be retained long enough to calculate session delta.
5. Required attribution/linkback presentation on Stream Deck and in the Property Inspector.
6. Production request quotas.

Until those items are cleared, Leetify-powered features may be built behind a provider interface and fixtures but must not be represented as production-ready paid functionality.

## GSI safety boundary

RatPack must only consume data CS2 deliberately sends through Game State Integration.

Do not:

- inject into CS2
- read game memory
- hook the process
- scrape the screen to recover hidden state
- automate gameplay input
- circumvent the distinction between normal-player and observer GSI payloads

Tournament and league rules may be stricter than normal matchmaking rules, so documentation should tell competitive event players to verify the event's third-party-software policy.

## Privacy and security

The live telemetry path must remain local:

CS2 -> 127.0.0.1 -> RatPack Stream Deck plugin -> Stream Deck

Requirements:

- bind the GSI HTTP server to 127.0.0.1 only
- accept POST only on the expected GSI route
- generate a per-install random auth token
- validate payload token and CS2 app id 730
- enforce a small request body limit
- reject malformed JSON
- do not upload raw GSI gameplay telemetry

External account APIs are a separate data path and must not receive GSI payloads.

## Platform support

V1: Windows only.

Reasoning:

- CS2 is meaningfully supported on Windows and Linux, not current native macOS.
- Stream Deck desktop is officially supported on Windows and macOS, not Linux.
- The practical overlap for the complete product is Windows.

## Lite scope

Free and deliberately small:

1. Live Score
2. Health
3. Money
4. Current Map
5. CS2 / GSI Status

Lite exists to demonstrate the core magic of a live CS2-aware Stream Deck without giving away the competitive analytics product.

## Pro scope

Pro is the full product and the first shipping target.

Planned Pro families:

- full normal-player live GSI metrics
- session analytics
- Premier and Competitive ranks when Leetify is commercially cleared
- FACEIT account and match data
- recent matches and form
- prebuilt Standard and XL dashboards
- richer Property Inspector setup and customization

## Pricing

- Lite: free
- Pro launch: $9.99 one-time
- Revisit $12.99 after the product is proven and the final feature/visual quality justifies it

## Opportunity

- Opportunity score: 86 / 100
- Confidence: 90 / 100
- Development difficulty: 7 / 10
- Maintenance risk: 6 / 10

## Principal risks

1. Leetify commercial-use/caching/attribution rules.
2. External API schema or rate-limit changes.
3. Incorrectly assuming observer GSI fields are available to normal players.
4. GSI install-path edge cases across custom Steam libraries.
5. Maintaining a clean Lite/Pro split without duplicating the engine.

## Required technical spike before release candidate

Capture real normal-player CS2 GSI payloads for at least:

- menu / map load
- round start
- player damage
- money change
- weapon change
- kill
- death
- bomb planted state if emitted in normal payload
- round end
- match end
- CS2 exit and reconnect

The implementation should use fixture recordings so normal development and regression testing do not require playing a live match every iteration.
