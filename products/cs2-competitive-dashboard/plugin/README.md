# CS2 Competitive Dashboard Plugin

Shared Stream Deck plugin source for:

* CS2 Competitive Dashboard Pro
* CS2 Competitive Dashboard Lite

## Architecture

Both Marketplace products are generated from one source tree with separate entry points and immutable plugin UUIDs.

* Pro: `com.packrat.cs2-competitive-dashboard-pro`
* Lite: `com.packrat.cs2-competitive-dashboard-lite`

Lite is a compile and build policy restriction, not a fork. Its live metric selector only exposes Score, Health, Money, and Map plus the shared Status action.

## Local live telemetry

Live CS2 tracking starts automatically after the plugin connects to Stream Deck. It does not depend on a Property Inspector Enable command or on Stream Deck global settings completing successfully.

The local host service:

1. Finds Steam and CS2.
2. Verifies the CS2 cfg directory is writable.
3. Starts a localhost only GSI listener.
4. Writes the appropriate Valve GSI cfg.
5. Persists local token, port, and CS2 path state as best effort.
6. Remains listening even if later provider settings fail.

Pro and Lite have separate cfg files, local state files, log files, and port blocks so they can remain installed together during a Lite to Pro upgrade.

### Pro local identity

```text
gamestate_integration_packrat_cs2_dashboard_pro.cfg
127.0.0.1:32123 through 32146
%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi-pro.json
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

### Lite local identity

```text
gamestate_integration_packrat_cs2_dashboard_lite.cfg
127.0.0.1:32147 through 32170
%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi-lite.json
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-lite.log
```

Default GSI data requests intentionally exclude observer oriented components such as `phase_countdowns`, `allplayers_*`, `allgrenades`, and the richer `bomb` object.

The Property Inspector reads a redacted localhost diagnostics endpoint directly. It does not need the old long running plugin command path to show CS2 path, cfg state, listener, last packet, and persistent log location.

## Pro provider setup

Pro uses customer owned provider credentials. PackRat does not operate or ship a shared FACEIT or Leetify API key.

The user enters:

* one Steam profile URL, SteamID64, or Steam vanity name
* their own free Leetify API key from `https://leetify.com/app/developer`
* their own free FACEIT API key created through `https://developers.faceit.com/`

The Property Inspector contains direct links and setup steps. Provider keys are stored in Stream Deck global plugin settings on the user's PC. The plugin does not return raw keys to the Property Inspector after saving them and does not send them to a PackRat service. Requests go directly from the Stream Deck plugin backend to the matching provider over HTTPS.

Leetify attribution and commercial use requirements still apply regardless of who owns the API key. The official unmodified Leetify attribution asset remains a release gate.

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
