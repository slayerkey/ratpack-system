# CS2 Competitive Dashboard Release Candidate

## Shipping decision

Ship **CS2 Competitive Dashboard Pro** as the next CS2 product.

**Launch price:** $14.99 one time.

Do **not** submit CS2 Competitive Dashboard Lite with the initial launch. Keep the Lite build available internally for testing and future strategy, but hold Marketplace publication because PackRat already sells the simpler paid **CS2 Live Stats** product at $6.99. A free Lite dashboard with Score, Health, Money, and Map would overlap too heavily with that existing paid product.

The intended customer ladder is:

* **CS2 Live Stats — $6.99:** simple live in game Stream Deck stats.
* **CS2 Competitive Dashboard Pro — $14.99:** the complete premium competitive system for serious CS2 players.

Every launch decision should pass this test: an existing CS2 Live Stats customer should immediately understand why Competitive Dashboard Pro is a separate premium upgrade rather than a remake.

## Pro listing

**Name:** CS2 Competitive Dashboard Pro

**Price:** $14.99

**Platform:** Stream Deck / Windows

**Minimum Stream Deck:** 6.9

### Short description

Turn your Stream Deck into a complete CS2 competitive dashboard with live match telemetry, session performance, Premier and Competitive rank views, FACEIT stats, and ready to use profiles.

### Product description

Keep the match information you actually care about on your Stream Deck while you play CS2.

CS2 Competitive Dashboard Pro combines local Valve Game State Integration, session tracking, Premier and Competitive data, FACEIT data, and purpose built Stream Deck layouts in one premium plugin. It is intentionally broader than the existing CS2 Live Stats product and is aimed at players who want a complete competitive command center rather than a handful of live counters.

**Ready to use profiles**

* Competitive profile for Premier, Competitive ranks, FACEIT, recent form, and session performance
* Live Match profile for score, round state, K/D, health, armor, money, weapon, ammo, ADR, HS%, bomb state, map, and connection status
* layouts for Stream Deck, Stream Deck Mini, Stream Deck XL, Stream Deck +, and Stream Deck Neo
* profiles remain fully editable
* profiles do not automatically hijack the user's active Stream Deck profile after installation

**Live CS2**

* score and round state
* kills, deaths, assists, and K/D
* session ADR and headshot percentage
* health, armor, money, and equipment value
* current weapon and ammo
* bomb state when available to the normal player GSI feed
* current map and team

**Session performance**

* wins and losses
* matches played
* K/D
* ADR
* HS%

**Competitive via Leetify**

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

## Customer setup

1. Install the plugin.
2. Start with the included **Competitive** or **Live Match** profile, or add individual actions anywhere you want.
3. Live CS2 tracking configures itself automatically when the plugin starts. There is no Enable button and no API key is required for local live tracking.
4. If CS2 was already open during first installation, close and relaunch it once so CS2 loads the new Valve GSI config.
5. Enter a normal CS2 game mode. The Property Inspector changes to **Connected to CS2** after the first game state update arrives.
6. Add a Steam profile URL, SteamID64, or vanity name once for optional online competitive data.
7. For Premier and Competitive account data, create a Leetify developer API key using the direct link inside the Property Inspector.
8. For FACEIT account data, create a FACEIT App/API key using the direct Developer Portal link inside the Property Inspector.
9. Select **Save Keys and Test Connection**.

Local live and session features require neither provider key. Leetify is required only for Leetify backed Competitive features. FACEIT is required only for FACEIT features.

## Provider architecture

Pro intentionally uses customer owned provider keys rather than shared PackRat credentials.

* Leetify key page: `https://leetify.com/app/developer`
* FACEIT Developer Portal: `https://developers.faceit.com/`
* FACEIT key guide: `https://docs.faceit.com/getting-started/authentication/api-keys/`

Keys are saved in Stream Deck plugin settings on that PC. They are never sent to a PackRat service. Provider requests go directly from the plugin backend to the corresponding official provider over HTTPS.

## Trust and privacy

Live CS2 Game State Integration is received on the user's own PC through a localhost only listener. Raw GSI gameplay data is not uploaded by PackRat.

Online provider requests send the configured Steam identity and the customer's provider key directly to the selected provider. PackRat does not proxy those requests.

## Provider attribution and release rules

### Leetify

Current Leetify developer guidelines require all apps and websites that include Leetify data to display the official unmodified **Data Provided by Leetify** logo. The logo must link to `https://leetify.com/`. Wherever original Leetify data is shown, provide a legible **View on Leetify** link back to the source. Do not modify, animate, recolor, or repurpose the logo. Do not present Leetify more prominently than PackRat or imply sponsorship/endorsement.

Leetify metrics must be presented as supplied. Do not rename, rescale, recalculate, or add misleading units. Do not persist returned Leetify profile data beyond what is necessary for the live runtime.

The official logo package is linked from Leetify's developer guidelines. The release build must contain the official file, not a recreated PackRat version.

**Hard gate:** do not publish the paid product with Leetify backed functionality until commercial paid use has been confirmed or the feature has been adjusted to a clearly permitted release model.

### FACEIT

FACEIT data is retrieved using the customer's own developer application/API key. FACEIT's current Data API documentation explicitly supports public player data and client side API keys for distributed apps/widgets. Do not imply that PackRat is an official FACEIT product or sponsored by FACEIT.

For Marketplace artwork, it is acceptable to place a factual FACEIT data/source label near the Leetify attribution area, but do not present a homemade FACEIT endorsement badge as an official attribution requirement unless FACEIT documentation specifically requires it.

## Important accuracy copy

The plugin only displays data available to a normal CS2 player or from the named online provider. It does not claim observer only exact round or bomb timers.

Premier and per map Competitive rank data require a registered and visible Leetify profile plus a Leetify API key. FACEIT data requires a matching FACEIT CS2 profile plus a FACEIT API key.

Provider setup requirements can change upstream. The Property Inspector links directly to official provider setup pages.

## Suggested keywords

CS2, Counter Strike 2, Counter Strike, FACEIT, Premier, rank, stats, competitive, GSI, Game State Integration, Steam, dashboard, tracker, gaming, Stream Deck profile

## Version 0.1.0.0 release notes

Initial release of CS2 Competitive Dashboard Pro.

* ready to use Competitive and Live Match profiles for supported Stream Deck models
* live CS2 Game State Integration
* automatic Steam/CS2 and local GSI setup
* session K/D, ADR, HS%, W/L, and match tracking
* Premier and Competitive rank views
* FACEIT Elo, level, performance, and recent form views
* guided setup for customer owned Leetify and FACEIT API keys
* direct provider links inside the Property Inspector
* configurable dynamic key displays
* persistent local host diagnostics for CS2 setup and GSI connectivity
* explicit setup, invalid key, offline, private profile, and rate limit states
* localhost only authenticated GSI listener
* no shared PackRat provider API keys or quota

## Listing truth gate

Do not publish screenshots or copy showing production Leetify values until:

1. paid/commercial use is cleared,
2. the official unmodified Leetify attribution asset is packaged,
3. the asset links to Leetify,
4. View on Leetify is available with provider backed values,
5. metric presentation matches the upstream values.

FACEIT screenshots should use truthful data from a customer owned development key or clearly labeled deterministic fixture data.

Do not describe exact timer functionality.

Do not imply Leetify or FACEIT sponsorship, endorsement, or official affiliation.

## Art direction

Final Marketplace art should be deterministic Rat Art using truthful captured or deterministic fixture states.

Recommended sequence:

1. Hero: clean Stream Deck key grid showing the strongest live, session, and competitive mix with minimal copy.
2. Feature breakdown: Live CS2 / Session / Competitive / FACEIT.
3. Profiles: Competitive and Live Match layouts as an ease of setup and premium value feature.
4. Setup: Property Inspector showing automatic GSI status, diagnostics, Steam profile, and provider setup cards.
5. Live states: Score, Health, Premier, FACEIT Elo, Session K/D, and HS%.
6. Source/attribution frame where provider backed data appears, using the official Leetify asset and a factual FACEIT source label.

Do not include a Lite vs Pro comparison in the initial gallery. The comparison that matters commercially is **CS2 Live Stats $6.99** versus **CS2 Competitive Dashboard Pro $14.99**, and that should only be used if it can be presented without confusing buyers.

## Final release gates

Before Marketplace submission:

1. Current branch passes all automated CS2 CI, RatPack Lightweight CI, Rat Art, official Elgato validation, and packaging checks.
2. One final physical Windows host pass confirms the render queue no longer creates a timeout storm.
3. Deathmatch Session HS% remains correct across multiple deaths and respawns.
4. Open Log Folder launches Explorer successfully.
5. Long weapon/map labels remain readable on physical keys.
6. Stream Deck and CS2 restart/recovery works without repeating setup.
7. One real customer owned Leetify key is tested.
8. One real customer owned FACEIT key is tested.
9. The official Leetify attribution asset is packaged and linked correctly.
10. Paid/commercial Leetify use is cleared or Leetify backed launch functionality is removed/held.
11. Final Marketplace artwork and copy are generated from the verified release candidate.

After those gates pass, stop adding features and ship Pro.
