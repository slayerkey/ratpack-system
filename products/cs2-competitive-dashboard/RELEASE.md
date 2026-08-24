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

* score and round state
* kills, deaths, assists, and K/D
* session ADR and headshot percentage
* health, armor, money, and equipment value
* current weapon and ammo
* bomb state available to the normal player GSI feed
* current map and team

**Session performance**

* wins and losses
* matches played
* K/D
* ADR
* HS%

**Competitive**

* Premier CS Rating
* current map Competitive rank
* best Competitive map rank
* recent result
* win rate
* Leetify Rating where available

**FACEIT**

* Elo
* level
* region
* K/D
* HS%
* win rate
* recent record
* recent match result

### Setup copy

1. Install the plugin.
2. Add any CS2 Competitive Dashboard Pro action to your Stream Deck.
3. Open the Property Inspector and select **Enable Live CS2 Tracking**.
4. Launch or restart CS2.
5. Add your Steam profile URL or SteamID once.
6. For Premier and Competitive account data, create a free Leetify developer API key using the direct link inside the Property Inspector and paste it into setup.
7. For FACEIT account data, create a free FACEIT App/API key using the direct Developer Portal link inside the Property Inspector and paste it into setup.
8. Select **Save Keys and Test Connection**.

The local live and session features do not require either provider key. The Leetify key is required for Leetify-backed Competitive features and the FACEIT key is required for FACEIT features.

The Property Inspector includes the exact provider links and short step by step instructions so users do not need to find developer pages themselves.

Steam and CS2 are auto-detected for normal installations. A manual path override is available only for unusual library layouts.

### Provider key disclosure

Pro intentionally uses **customer-owned free provider keys** instead of a shared PackRat provider account.

* Leetify key page: `https://leetify.com/app/developer`
* FACEIT Developer Portal: `https://developers.faceit.com/`
* FACEIT key guide: `https://docs.faceit.com/getting-started/authentication/api-keys/`

Keys are saved in the plugin's local Stream Deck global settings on that PC. The plugin does not send provider keys to a PackRat server and does not operate a shared FACEIT or Leetify quota. Online requests are made directly from the Stream Deck plugin backend to the corresponding provider over HTTPS.

Each customer's provider usage is therefore isolated to their own key. Provider rate limits, revocation, and key replacement affect that customer rather than every PackRat user.

### Trust / privacy copy

Live CS2 Game State Integration is received on your own PC through a localhost-only listener. Raw GSI gameplay data is not uploaded by PackRat.

For online account data, the plugin sends the configured Steam identity and that provider's customer-owned API key directly to the corresponding provider API. PackRat does not receive or proxy those requests.

### Provider attribution copy

Competitive values sourced from Leetify are **Data Provided by Leetify**. The required official Leetify attribution and `View on Leetify` link are shown wherever those provider-backed values are exposed. PackRat is not affiliated with or sponsored by Leetify.

FACEIT values are retrieved through the user's own FACEIT developer application/API key. PackRat is not affiliated with or sponsored by FACEIT.

### Important accuracy copy

The plugin only displays data available to a normal CS2 player or from the named online provider. It does not claim observer-only exact round or bomb timers.

Premier and per-map Competitive rank data require a registered and visible Leetify profile plus the user's Leetify API key. FACEIT data requires a matching FACEIT CS2 profile plus the user's FACEIT API key.

Provider setup requirements can change upstream. The Property Inspector links directly to the current official provider setup pages.

### Suggested keywords

CS2, Counter-Strike 2, Counter Strike, FACEIT, Premier, rank, stats, competitive, GSI, Game State Integration, Steam, dashboard, tracker, gaming

### Version 0.1.0.0 release notes

Initial release of CS2 Competitive Dashboard Pro.

* live CS2 Game State Integration
* automatic Steam/CS2 setup
* session K/D, ADR, HS%, W/L and match tracking
* Premier and Competitive rank views
* FACEIT Elo, level, performance and recent form views
* guided setup for free customer-owned Leetify and FACEIT API keys
* direct provider links inside the Property Inspector
* configurable dynamic key displays
* explicit setup, invalid-key, offline, private-profile and rate-limit states
* localhost-only authenticated GSI listener
* no shared PackRat provider API keys or provider quota

## Lite listing

**Name:** CS2 Competitive Dashboard Lite

**Price:** Free

### Short description

A simple live CS2 Stream Deck dashboard for Score, Health, Money, Map, and connection status.

### Lite product description

Get the most useful live CS2 information on your Stream Deck without account integrations or provider API keys.

Includes:

* Live Score
* Health
* Money
* Current Map
* CS2 / GSI Status
* one-click live tracking setup

For session performance, Premier and Competitive ranks, FACEIT stats, weapons/ammo, and the complete live metric set, use CS2 Competitive Dashboard Pro.

## Listing truth gate

Do not publish screenshots or copy showing production Leetify values until Leetify's commercial-use requirements are cleared and the official unmodified Leetify attribution asset is in the packaged Pro build.

FACEIT screenshots should use a test/customer-owned development key and truthful provider data or clearly labeled deterministic fixture data.

Do not describe exact timer functionality.

Do not imply Leetify or FACEIT sponsorship, endorsement, or official affiliation.

## Art direction

Final marketplace art should be deterministic Rat Art, not generated imagery.

Recommended sequence:

1. Hero: clean Stream Deck key grid showing the strongest live/session/competitive mix, with minimal copy.
2. Feature breakdown: Live CS2 / Session / Competitive / FACEIT as the four value areas.
3. Setup: Property Inspector showing one-click GSI setup, Steam profile, and the guided provider key cards.
4. Live states: examples of Score, Health, Premier, FACEIT Elo, Session K/D.
5. Lite vs Pro / ecosystem frame after Pro is published.

The gallery should use truthful captured or deterministic fixture states and the official unmodified Leetify attribution asset anywhere Leetify data is shown.
