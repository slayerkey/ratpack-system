# CS2 Competitive Dashboard Release Candidate

## Shipping order

Ship **CS2 Competitive Dashboard Pro** first.

Keep **CS2 Competitive Dashboard Lite** packaged and ready, but do not submit Lite until the Pro Marketplace URL exists. Then change Lite's footer/upgrade URL from the PackRat creator page to the direct Pro listing and rebuild.

## Pro listing

**Name:** CS2 Competitive Dashboard Pro

**Target price:** $9.99

**Platform:** Stream Deck / Windows

**Minimum Stream Deck:** 6.9

### Short description

Turn your Stream Deck into a live CS2 competitive dashboard with match telemetry, session performance, Premier and Competitive rank views, and FACEIT stats.

### Product description

Keep the match information you actually care about on your Stream Deck while you play CS2.

CS2 Competitive Dashboard Pro combines local Game State Integration with session tracking and optional competitive account data in one configurable plugin.

**Live CS2**

- score and round state
- kills, deaths, assists, and K/D
- session ADR and headshot percentage
- health, armor, money, and equipment value
- current weapon and ammo
- bomb state available to the normal player GSI feed
- current map and team

**Session performance**

- wins and losses
- matches played
- K/D
- ADR
- HS%

**Competitive**

- Premier CS Rating
- current-map Competitive rank
- best Competitive map rank
- recent result
- win rate
- Leetify Rating where available

**FACEIT**

- Elo
- level
- region
- K/D
- HS%
- win rate
- recent record
- recent match result

### Setup copy

1. Install the plugin.
2. Add any CS2 Competitive Dashboard Pro action to your Stream Deck.
3. Open the Property Inspector and select **Enable Live CS2 Tracking**.
4. Launch or restart CS2.
5. For Premier, Competitive, and FACEIT account data, add your Steam profile URL or SteamID once.

Steam and CS2 are auto-detected for normal installations. A manual path override is available only for unusual library layouts.

### Trust / privacy copy

Live CS2 Game State Integration is received on your own PC through a localhost-only listener. Raw GSI gameplay data is not sent to the PackRat provider gateway.

Competitive account lookups send only the Steam identity needed for the requested public/provider-backed stats. Provider credentials remain server-side.

### Important accuracy copy

The plugin only displays data available to a normal CS2 player or from the named online provider. It does not claim observer-only exact round/bomb timers.

Premier and per-map Competitive rank data require a registered and visible Leetify profile. FACEIT data requires a matching FACEIT CS2 profile.

### Suggested keywords

CS2, Counter-Strike 2, Counter Strike, FACEIT, Premier, rank, stats, competitive, GSI, Game State Integration, Steam, dashboard, tracker, gaming

### Version 0.1.0.0 release notes

Initial release of CS2 Competitive Dashboard Pro.

- live CS2 Game State Integration
- automatic Steam/CS2 setup
- session K/D, ADR, HS%, W/L and match tracking
- Premier and Competitive rank views
- FACEIT Elo, level, performance and recent-form views
- configurable dynamic key displays
- explicit setup, offline, private-profile and rate-limit states
- localhost-only authenticated GSI listener

## Lite listing

**Name:** CS2 Competitive Dashboard Lite

**Price:** Free

### Short description

A simple live CS2 Stream Deck dashboard for Score, Health, Money, Map, and connection status.

### Lite product description

Get the most useful live CS2 information on your Stream Deck without extra setup or account integrations.

Includes:

- Live Score
- Health
- Money
- Current Map
- CS2 / GSI Status
- one-click live tracking setup

For session performance, Premier and Competitive ranks, FACEIT stats, weapons/ammo, and the complete live metric set, use CS2 Competitive Dashboard Pro.

## Listing truth gate

Do not publish screenshots/copy showing working Premier/Competitive/FACEIT values until the production gateway is deployed and the official Leetify attribution asset is in the packaged Pro build.

Do not describe exact timer functionality.

Do not imply Leetify or FACEIT sponsorship, endorsement, or official affiliation.

## Art direction

Final marketplace art should be deterministic Rat Art, not generated imagery.

Recommended sequence:

1. Hero: clean Stream Deck key grid showing the strongest live/session/competitive mix, with minimal copy.
2. Feature breakdown: Live CS2 / Session / Competitive / FACEIT as the four value areas.
3. Setup: Property Inspector showing one-click GSI setup and one Steam profile field.
4. Live states: examples of Score, Health, Premier, FACEIT Elo, Session K/D.
5. Lite vs Pro / ecosystem frame after Pro is published.

The gallery should use truthful captured or deterministic fixture states and the official unmodified Leetify attribution asset anywhere Leetify data is shown.
