# CS2 Competitive Dashboard host debugging record

Date: 2026-08-24
Updated after the deep host debugging and Pro/Lite coexistence pass.

This document separates what is proven by source and CI from what still requires the real Windows, CS2, and Stream Deck host.

## Real host symptom

On the Windows test machine:

* The Property Inspector WebSocket connected.
* Earlier custom commands such as Enable Live Tracking, Disable, and Advanced Diagnostics could be clicked but then stalled for roughly 12 to 15 seconds.
* Steam profile save previously showed the same non completing behavior.
* The first automatic GSI rewrite did not solve the live connection.
* CS2 is installed at `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive`.
* The real cfg directory is `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg`.

## Known working reference from the same machine

The supplied `cs2 live tracker.zip` is treated as a known working reference because its packaged logs came from the same Windows host.

Repeated host evidence includes:

```text
2026-08-24T22:45:15.571Z INFO GSI listening on http://127.0.0.1:3000
2026-08-24T22:45:15.656Z INFO CS2 GSI config: exists
```

Its useful reliability property is a very short critical path:

```text
Stream Deck connect
→ start local listener
→ locate CS2 cfg
→ ensure cfg exists
→ stay listening
```

A later settings failure cannot undo a working listener and config.

## Concrete root cause in the previous dashboard architecture

The old dashboard setup sequence was:

```text
find CS2
→ start listener
→ write Valve GSI config
→ write Stream Deck global settings
→ check CS2 process
→ mark ready
```

Its catch path then did this for any later failure:

```text
stop listener
→ delete the newly written GSI config
→ clear setup state
```

A stalled or failed `streamDeck.settings.setGlobalSettings()` call could therefore occur after the two operations that actually matter to Valve GSI had already succeeded, then deliberately undo both successful operations.

The first automatic setup rewrite still called that same setup routine, so it inherited the rollback failure mode.

This is strongly consistent with the earlier real host history because Steam profile save and long Property Inspector commands also stalled around Stream Deck settings or command handling.

## Current critical path

Local GSI is now deliberately independent of Stream Deck global settings:

```text
plugin process starts
→ Stream Deck connects
→ GsiHostService starts
→ load tiny local GSI state if present
→ resolve CS2 install
→ prove cfg exists and is writable
→ bind localhost listener
→ write flavor specific Valve GSI config
→ persist local token, port, and path as best effort
→ detect cs2.exe
→ remain listening
```

Only after local GSI setup does Pro attempt a Stream Deck global settings read. That read has a short timeout. A failure is logged as:

```text
global settings load failed; local GSI remains active
```

Provider settings therefore cannot tear down local live tracking.

## Pro and Lite coexistence

A Lite customer may install Pro without uninstalling Lite first, so the two Marketplace products must not fight over one local integration.

They now have separate host identities.

### Pro

```text
Valve cfg:
gamestate_integration_packrat_cs2_dashboard_pro.cfg

Default listener block:
127.0.0.1:32123 through 32146

Local state:
%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi-pro.json

Persistent log:
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

### Lite

```text
Valve cfg:
gamestate_integration_packrat_cs2_dashboard_lite.cfg

Default listener block:
127.0.0.1:32147 through 32170

Local state:
%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi-lite.json

Persistent log:
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-lite.log
```

The products use immutable `.sdPlugin` paths. Flavor detection is anchored to the bundled module URL, with cwd and argv as fallbacks, so it does not rely on Stream Deck preserving a particular process working directory.

The obsolete shared cfg `gamestate_integration_packrat_cs2_dashboard.cfg` is removed after a current flavor cfg is installed. The obsolete shared local state `gsi.json` can migrate into Pro only. Lite starts with its own token and port state.

CS2 supports multiple GSI cfg files, so Pro and Lite may both remain installed and both receive their own local payload stream.

Listener retries are bounded to each product's own 24 port block. A saved Pro port at the top of its block can never spill into Lite's block if that port becomes occupied.

## Current GSI config contract

Each flavor config targets a localhost root URI:

```text
http://127.0.0.1:PORT/
```

The production server also accepts legacy `/gsi` during migration.

Security boundaries remain:

* bind only to `127.0.0.1`
* random local GSI auth token
* CS2 App ID 730 validation
* request body cap
* malformed JSON rejection
* normal player GSI components only
* no observer only allplayers, grenade, or countdown feed

A valid GSI request returns HTTP 200.

## Persistent observability

The Pro process writes:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

Lite writes the corresponding `cs2-competitive-dashboard-lite.log` file.

The build prints both exact paths during Rat Dev.

The log records:

* plugin process start, product flavor, PID, version, plugin path, Node and platform
* Stream Deck connection start, success, or failure
* global settings channel state without provider secrets
* Steam candidates and selected CS2 and cfg paths
* cfg existence and write probe
* listener bind attempts, chosen port, and actual URL
* config target and write result
* CS2 process state
* first incoming GSI request with method, path, and body size
* JSON parse result
* auth accepted or rejected without logging the token
* provider App ID accepted or rejected
* normalization result
* first GSI packet and periodic heartbeat
* runtime connected state
* throttled Stream Deck key refresh completion
* startup errors with stack traces
* uncaught exceptions and unhandled rejections

Normal successful packet details are throttled so normal GSI traffic cannot flood the log. Errors are always recorded. The in memory diagnostic snapshot updates on every valid packet.

## Property Inspector diagnostics

Advanced Diagnostics is visible but does not launch the old blocking `sendToPlugin` diagnostic command.

The Pro Property Inspector probes only ports 32123 through 32146. Lite probes only 32147 through 32170. Each panel also requires the diagnostic response flavor to match its own build.

The endpoint is:

```text
GET http://127.0.0.1:PORT/packrat/diagnostics
```

It returns a redacted state and summary showing:

* plugin process
* Stream Deck connection
* CS2 install
* cfg state and writeability
* current flavor GSI config
* listener URL and port
* CS2 process state
* last GSI packet
* live connected state
* last error
* persistent log path

Controls:

* Open Log Folder
* Copy Diagnostic Summary

Those controls use the localhost service and do not depend on the old long running Property Inspector command path.

If the listener fails before the diagnostic endpoint exists, the persistent AppData log remains the primary evidence because it is created at process startup.

## Production transport integration proof

Automated integration starts the exact production `GsiServer`, creates the actual `DashboardRuntime`, posts a realistic CS2 payload to the exact root URI, and verifies:

* HTTP 200
* runtime `gsiConnected === true`
* health becomes 82
* money becomes 4250
* kills become 17
* active AK ammo becomes 22
* the Health key display becomes 82
* the diagnostic endpoint reports a packet timestamp and count

Additional transport checks cover:

* legacy `/gsi`
* wrong token returning 401
* wrong App ID returning 400
* malformed JSON returning 400
* wrong method returning 405
* wrong route returning 404

The tests use distinct valid Pro ports inside the production allowed block so the test harness cannot weaken the real port isolation policy.

This proves the packaged transport and runtime path in isolation. It does not prove that the real CS2 process on the user's machine loaded the cfg and sent a packet, which is why the Windows host gate remains required.

## Stage by stage host evidence

| Runtime stage | Independent evidence |
| --- | --- |
| plugin process starts | first line of flavor specific AppData log |
| Stream Deck connection | persistent log and diagnostic snapshot |
| settings channel | responsive, timeout, or error in persistent diagnostics; not required for GSI |
| Steam and CS2 detection | selected paths in log |
| cfg exists and writable | access plus temporary write probe |
| listener bind | log, diagnostic endpoint, and listener URL |
| config generated | exact flavor cfg path and root URI in log |
| CS2 process | tasklist based state |
| HTTP POST from CS2 | request and body byte evidence |
| JSON parse | explicit success or error |
| auth | accepted or rejected without token value |
| App ID 730 | accepted or rejected |
| normalization | success or full error stack |
| runtime connected | log and diagnostic state |
| key refresh | throttled key refresh completion log |

## Required Windows host gate

Use the current canonical local updater:

```text
rat main
rat dev cs2-competitive-dashboard
```

Rat Dev links Pro.

Do not press an Enable button. Local GSI starts automatically.

Open any Pro dashboard Property Inspector and inspect Advanced Diagnostics.

Before CS2 launches, expected state is approximately:

```text
Plugin process     Running
Stream Deck        Connected
CS2 install        C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive
CFG folder         Found and writable
GSI config         gamestate_integration_packrat_cs2_dashboard_pro.cfg
Local listener     http://127.0.0.1:32123/ or another port through 32146
CS2 process        Not detected
Last GSI packet    None
GSI connected      No
Last error         None
```

If CS2 was already open when the new build was first linked, close it fully once and relaunch it so Valve loads the new cfg.

Enter Deathmatch or another normal game mode.

Expected next state:

```text
CS2 process        Running
Last GSI packet    current timestamp
GSI connected      YES / LIVE
```

Physical live keys should then change from waiting states to real values.

## What to return if the host still fails

First use **Copy Diagnostic Summary** and paste the full result.

Also send the full contents of:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

If the Advanced Diagnostics panel cannot find the Pro local service, the Pro persistent log is the primary evidence.

The manifest also enables Node debugging, so the Stream Deck managed plugin log can be inspected afterward if the persistent log shows a crash before or during SDK connection.

Do not claim the Windows host gate passed until a real CS2 packet is visible in diagnostics and a physical Stream Deck key changes.
