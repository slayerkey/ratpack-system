# CS2 Competitive Dashboard QA

Date: 2026-08-24

## Current release state

The product remains **TESTING** until the real Windows host shows an actual CS2 GSI packet arriving and a physical Stream Deck key changing.

A green CI run is necessary but is not treated as proof that Valve loaded the cfg on the user's machine.

The detailed root cause investigation and host evidence map live in:

`products/cs2-competitive-dashboard/HOST_DEBUG_GSI_2026-08-24.md`

## GSI root cause regression

The previous dashboard architecture made local GSI setup depend on a later Stream Deck global settings write. The old sequence could:

1. find CS2
2. start the listener
3. write the GSI cfg
4. stall or fail on `streamDeck.settings.setGlobalSettings()`
5. stop the working listener
6. delete the cfg it had just written

The first automatic setup rewrite still called that same old setup routine and therefore inherited the same rollback behavior.

The critical local GSI path is now separate from Stream Deck global settings.

Expected startup:

```text
Stream Deck connect
→ local GSI host service
→ resolve CS2
→ prove cfg is writable
→ bind localhost listener
→ write cfg
→ persist local GSI convenience state as best effort
→ remain listening
```

Provider/global settings are handled afterward in Pro. A provider/settings problem cannot tear down an already working CS2 listener/config.

## Pro and Lite coexistence regression

Pro and Lite must be able to remain installed at the same time. This matters directly to the Lite to Pro upgrade path.

The products therefore use separate local host identities:

### Pro

* Valve cfg: `gamestate_integration_packrat_cs2_dashboard_pro.cfg`
* default port range starts at `32123`
* local state: `%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi-pro.json`
* persistent log: `%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log`

### Lite

* Valve cfg: `gamestate_integration_packrat_cs2_dashboard_lite.cfg`
* default port range starts at `32147`
* local state: `%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi-lite.json`
* persistent log: `%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-lite.log`

The obsolete shared cfg `gamestate_integration_packrat_cs2_dashboard.cfg` is removed after a current flavor cfg is installed. The obsolete shared local state is migrated into Pro only. Never remove the other current flavor's cfg because CS2 supports multiple GSI integrations and may publish to both products.

## Persistent host diagnostics

Every Pro/Lite process writes a persistent log independent of Property Inspector RPC.

Rat Dev links Pro, so the primary real-host troubleshooting artifact is:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

Lite uses the corresponding `cs2-competitive-dashboard-lite.log` file.

The normal build prints both paths during development.

The log must record enough evidence to locate a failure without guessing, including:

* process start, flavor, PID, version and plugin directory
* Stream Deck connection start/success/failure
* settings channel state without secrets
* Steam candidates and selected CS2/cfg paths
* cfg existence and writeability probe
* listener bind attempts, final port and URL
* cfg write path/result
* CS2 process state
* first GSI HTTP request, method/path/body size
* JSON parse, auth and App ID state
* first GSI packet and periodic heartbeat
* normalization success/failure
* runtime connected state
* throttled key refresh start/finish/failure
* startup exceptions and stack traces

Do not log FACEIT keys, Leetify keys, authorization headers, full GSI tokens, or other secrets.

The Property Inspector's visible Advanced Diagnostics section reads the redacted localhost diagnostic endpoint directly. It must not depend on the long running `sendToPlugin` command path that previously timed out.

Expected diagnostic endpoint:

```text
GET http://127.0.0.1:<selected-port>/packrat/diagnostics
```

The Pro PI only probes the Pro port range and only accepts a diagnostic state whose flavor is `pro`. Lite does the same for `lite`. This prevents a Pro Property Inspector from accidentally attaching to the Lite service when both products are installed.

Expected controls:

* Open Log Folder
* Copy Diagnostic Summary

If the listener never starts, the AppData log is still the primary evidence.

## Automated release evidence

Automated checks cover:

* TypeScript typecheck
* exact production GSI server to DashboardRuntime integration test
* root GSI POST → connected runtime → changed live key display
* root URI config generation matching the known working host pattern
* legacy `/gsi` acceptance during migration
* wrong method rejection
* wrong route rejection
* malformed JSON rejection
* wrong GSI token rejection
* App ID 730 rejection for non CS2 payloads
* localhost only authenticated GSI listener behavior
* normal player GSI normalization fixtures
* Steam library and custom library discovery fixtures
* manual install root and exact `game\csgo\cfg` normalization
* cfg generation and atomic write behavior
* local GSI startup has no Stream Deck settings dependency
* Pro/Lite cfg filenames are distinct
* Pro/Lite local state files are distinct
* Pro/Lite persistent log files are distinct
* Pro/Lite default port ranges are distinct
* diagnostics discovery is scoped to the current flavor
* persistent diagnostics do not depend on Property Inspector RPC
* session K/D, derived ADR, HS%, match finalization and W/L fixtures
* direct Leetify provider normalization using a customer key fixture
* direct FACEIT provider normalization using a customer key fixture
* missing/rejected/rate limited provider states
* production dependency audit at high severity
* exact Pro action surface policy
* exact Lite action/metric ceiling policy
* no bundled PackRat provider credentials
* direct official provider setup links in the Property Inspector
* masked provider key inputs
* conservative provider refresh jitter tests
* Pro and Lite builds
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

There is no shared PackRat FACEIT or Leetify provider gateway.

Pro uses customer owned provider keys:

* Leetify API key from `https://leetify.com/app/developer`
* FACEIT API key created through `https://developers.faceit.com/`
* official FACEIT key instructions at `https://docs.faceit.com/getting-started/authentication/api-keys/`

Expected provider path:

```text
Stream Deck plugin backend → official provider HTTPS API
```

Requirements:

* provider keys are saved in Stream Deck global plugin settings on the user's PC
* raw saved keys are never returned to the Property Inspector after save
* key input fields use password masking
* no customer provider key is sent to a PackRat service
* no PackRat provider secret is bundled in Pro or Lite
* Steam identity resolution does not require a Steam Web API key
* Leetify and FACEIT setup/rejected/not-found/private/rate-limit/offline states remain explicit
* one customer's provider quota cannot consume another customer's allowance through a shared PackRat key

### Provider refresh strategy

Online profile data is slow changing data, not live telemetry.

* normal background refresh uses the conservative jitter window
* manual refresh remains immediate
* completing a local CS2 match schedules a delayed provider refresh
* provider 429 responses render an explicit `rate_limited` state instead of tight retrying

## Rat Dev local install

Development testing should not use ZIP downloads.

```text
rat main
rat dev cs2-competitive-dashboard
```

Rat Dev fetches the product branch, builds/tests Pro, runs the official Stream Deck validator, links the generated Pro `.sdPlugin` into developer mode and restarts it.

The build also prints:

```text
Pro host diagnostics after install: %APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
Lite host diagnostics after install: %APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-lite.log
```

Bundled profiles remain a separate development install behavior. Manual `.streamDeckProfile` installation already worked. Do not let profile auto installation distract from the GSI host gate.

## Required Windows GSI host gate

1. Run `rat main`.
2. Run `rat dev cs2-competitive-dashboard`.
3. Do **not** click an Enable button. Local GSI starts automatically.
4. Open any dashboard Property Inspector.
5. Advanced Diagnostics should find the Pro local diagnostic service within a few seconds.
6. Before CS2 starts, verify:
   * plugin process = running
   * Stream Deck = connected
   * CS2 install = detected
   * cfg folder = found/writable
   * GSI config = `gamestate_integration_packrat_cs2_dashboard_pro.cfg`
   * listener = running on `127.0.0.1`, normally starting at port `32123`
   * last GSI packet = none
7. If CS2 was open during first install, close it fully and relaunch once.
8. Enter Deathmatch or another normal game mode.
9. Verify:
   * CS2 process = running
   * last GSI packet gets a current timestamp
   * GSI connected = YES / LIVE
   * live physical keys change to real values
10. Verify the persistent log reaches:
   * incoming HTTP request
   * JSON parse success
   * auth accepted
   * App ID 730 accepted
   * normalization success
   * runtime marked connected
   * key refresh finished

Do not mark this gate passed until the real host reaches step 9.

## What to collect if the host still fails

First use **Copy Diagnostic Summary** and paste the full result.

Also send the full contents of:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

If Advanced Diagnostics cannot find the local service at all, the persistent Pro AppData log is the primary artifact because it is created at process startup before listener/config setup.

The manifest also enables Node debugging, so Stream Deck managed plugin logs can be inspected if the persistent log indicates a crash at SDK connection.

## Remaining release blockers

1. **Real Windows GSI smoke test** described above.
2. **Real customer provider key smoke test** for Leetify and FACEIT.
3. **Leetify paid/commercial attribution clearance** and official unmodified attribution asset.
4. **Physical Stream Deck smoke test** across live/session/provider rendering and restart recovery.

Everything before those external boundaries should remain automated.
