# CS2 Competitive Dashboard Plugin

Shared Stream Deck plugin source for:

* CS2 Competitive Dashboard Pro
* CS2 Competitive Dashboard Lite

## Architecture

Both Marketplace products are generated from one source tree with separate entry points and immutable plugin UUIDs.

* Pro: `com.packrat.cs2-competitive-dashboard-pro`
* Lite: `com.packrat.cs2-competitive-dashboard-lite`

Lite is a compile/build policy restriction, not a fork. Its live metric selector only exposes Score, Health, Money, and Map plus the shared Status action.

## Local live telemetry

The plugin hosts a localhost-only CS2 Game State Integration listener and can generate the required CS2 GSI config automatically.

Default GSI data requests intentionally exclude observer-oriented components such as `phase_countdowns`, `allplayers_*`, `allgrenades`, and the richer `bomb` object.

## Pro provider setup

Pro uses customer-owned provider credentials. PackRat does not operate or ship a shared FACEIT or Leetify API key.

The user enters:

* one Steam profile URL, SteamID64, or Steam vanity name
* their own free Leetify API key from `https://leetify.com/app/developer`
* their own free FACEIT API key created through `https://developers.faceit.com/`

The Property Inspector contains direct links and setup steps. Provider keys are stored in Stream Deck global plugin settings on the user's PC. The plugin does not return the raw keys to the Property Inspector after saving them and does not send them to a PackRat service. Requests go directly from the Stream Deck plugin backend to the matching provider over HTTPS.

Leetify attribution and commercial-use requirements still apply regardless of who owns the API key. The official unmodified Leetify attribution asset remains a release gate.

## Commands

```text
npm install
npm run typecheck
npm test
npm run build
npm run validate
npm run pack
```

`npm run build` generates both `.sdPlugin` directories under `out/`.

`npm run pack` writes both installable `.streamDeckPlugin` packages under `dist/`.
