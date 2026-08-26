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

Turn your Stream Deck into a live CS2 competitive dashboard with match telemetry, session performance, Premier and Competitive rank views, FACEIT stats, and ready-to-use profiles.

### Product description

Keep the match information you actually care about on your Stream Deck while you play CS2.

CS2 Competitive Dashboard Pro combines local Game State Integration with session tracking and optional competitive account data in one configurable plugin. It also includes purpose-built Stream Deck layouts so users do not have to configure every metric key by hand.

**Ready-to-use profiles**

* Competitive profile for Premier, Competitive ranks, FACEIT, recent form, and session performance
* Live Match profile for score, round state, K/D, health, money, weapon, ADR, HS%, bomb state, map, and connection status
* layouts for Stream Deck, Stream Deck Mini, Stream Deck XL, Stream Deck +, and Stream Deck Neo
* profiles install with the plugin and remain fully editable
* profiles do not automatically hijack the user's active Stream Deck profile after installation

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

1. Install the plugin and accept the included Stream Deck profiles for your device if prompted.
2. Start with the included **Competitive** or **Live Match** profile, or add individual CS2 Competitive Dashboard Pro actions anywhere you want.
3. Live CS2 tracking configures itself automatically when the plugin starts. There is no Enable button and no API key required for live tracking.
4. If CS2 was already open during the first install, close and relaunch it once so CS2 loads the new Valve GSI config.
5. Enter a normal CS2 game mode. The Property Inspector changes to **Connected to CS2** after the first game state update arrives.
6. Add your Steam profile URL or SteamID once for optional online competitive data.
7. For Premier and Competitive account data, create a free Leetify developer API key using the direct link inside the Property Inspector and paste it into setup.
8. For FACEIT account data, create a free FACEIT App/API key using the direct Developer Portal link inside the Property Inspector and paste it into setup.
9. Select **Save Keys and Test Connection**.

The local live and session features do not require either provider key. The Leetify key is required for Leetify-backed Competitive features and the FACEIT key is required for FACEIT features.

The Property Inspector includes the exact provider links and short step by step instructions so users do not need to find developer pages themselves.

Steam and CS2 are auto-detected for normal installations. The plugin automatically installs its localhost Valve GSI configuration. Advanced Diagnostics shows the detected CS2 path, cfg writeability, local listener, config path, CS2 process state, last GSI packet, and persistent log location.

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

CS2, Counter-Strike 2, Counter Strike, FACEIT, Premier, rank, stats, competitive, GSI, Game State Integration, Steam, dashboard, tracker, gaming, Stream Deck profile

### Version 0.1.0.0 release notes

Initial release of CS2 Competitive Dashboard Pro.

* ready-to-use Competitive and Live Match profiles for supported Stream Deck models
* live CS2 Game State Integration
* automatic Steam/CS2 and local GSI setup
* session K/D, ADR, HS%, W/L and match tracking
* Premier and Competitive rank views
* FACEIT Elo, level, performance and recent form views
* guided setup for free customer-owned Leetify and FACEIT API keys
* direct provider links inside the Property Inspector
* configurable dynamic key displays
* persistent local host diagnostics for CS2 setup and GSI connectivity
* explicit setup, invalid-key, offline, private-profile and rate-limit states
* localhost-only authenticated GSI listener
* no shared PackRat provider API keys or provider quota

## Lite listing

**Name:** CS2 Competitive Dashboard Lite

**Price:** Free

### Short description

A simple live CS2 Stream Deck dashboard for Score, Health, Money, Map, and connection status, with a ready-to-use starter profile.

### Lite product description

Get the most useful live CS2 information on your Stream Deck without account integrations or provider API keys.

Includes:

* Live Score
* Health
* Money
* Current Map
* CS2 / GSI Status
* automatic live tracking setup
* built in local diagnostics for CS2 and GSI connectivity
* one basic ready-to-use starter profile for supported Stream Deck models

For session performance, Premier and Competitive ranks, FACEIT stats, weapons/ammo, the complete live metric set, and separate **Competitive + Live Match profiles**, use CS2 Competitive Dashboard Pro.

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
3. Profiles: show the Competitive and Live Match layouts as an ease-of-setup and Pro-value feature.
4. Setup: Property Inspector showing automatic GSI status and diagnostics, Steam profile, and the guided provider key cards.
5. Live states: examples of Score, Health, Premier, FACEIT Elo, Session K/D.
6. Lite vs Pro / ecosystem frame after Pro is published.

The gallery should use truthful captured or deterministic fixture states and the official unmodified Leetify attribution asset anywhere Leetify data is shown.
