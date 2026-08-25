# CS2 Competitive Dashboard host debugging record

Date: 2026-08-24

This document records the Windows GSI debugging pass for the Stream Deck product. It deliberately separates what is proven by source/CI from what still requires the real Windows + CS2 host.

## Host symptom

On the real Windows test machine:

* the Property Inspector WebSocket connected
* custom plugin commands such as Enable Live Tracking, Disable, and the old Advanced Diagnostics command could be clicked
* those commands then stalled for roughly 12 to 15 seconds
* Steam profile save previously showed the same non-completing behavior
* the later automatic setup did not solve the live GSI connection
* the user confirmed CS2 is installed at `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive`
* the real cfg folder is `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg`

## Known working reference on the same machine

The supplied `cs2 live tracker.zip` is treated as a known working reference because its packaged logs came from the same Windows host.

Repeated real host log evidence includes:

```text
2026-08-24T22:45:15.571Z INFO  GSI listening on http://127.0.0.1:3000
2026-08-24T22:45:15.656Z INFO  CS2 GSI config: exists
```

The same pair appears across many reference plugin launches on August 22 through August 24.

The reference startup is intentionally simple:

```text
Stream Deck connect
→ read optional port setting
→ start one localhost HTTP listener
→ locate CS2 cfg
→ ensure cfg exists
→ stay running
```

A successful listener/config is not rolled back because some unrelated later setting operation failed.

## Concrete architectural root cause in the dashboard before this pass

The dashboard's old `enableGsi()` flow was:

```text
find CS2
→ start listener
→ write Valve GSI config
→ write Stream Deck global settings
→ check CS2 process
→ mark ready
```

The catch path then did this for any later failure:

```text
stop listener
→ delete the newly written GSI config
→ clear the setup state
```

Therefore a stalled or failed `streamDeck.settings.setGlobalSettings()` call could occur after the two operations that actually matter to Valve GSI had already succeeded, and then deliberately undo both of those successful operations.

This is strongly consistent with the real host history because Steam profile save and the long Property Inspector commands also stalled around Stream Deck settings/plugin command handling.

The first automatic setup rewrite did not remove this dependency. It invoked the same old `enableGsi()` path in the background, so it inherited the same rollback failure mode.

The Windows host log from the broken dashboard was not available in the uploaded test packages. Those packages contain no runtime `.log` files. This pass therefore adds a persistent diagnostic log before the next host test rather than claiming the exact host call stack has already been captured.

## Working reference comparison

| Area | Known working CS2 Live Stats | Dashboard before this pass | Failure relevance |
| --- | --- | --- | --- |
| Stream Deck SDK | `@elgato/streamdeck ^2.1.0`, SDK 3 | `^2.0.1` range resolving the same 2.1 generation, SDK 3 | Low |
| Node runtime | Node 20, Debug enabled | Node 20, Debug was not enabled | Debug flag affects observability, not expected GSI semantics |
| Startup ordering | connect, read port, start listener, ensure cfg | connect, runtime/settings setup, listener/config, then settings write | High |
| Critical settings write | no settings write after listener/config | `setGlobalSettings()` was required before setup could succeed | **Highest** |
| Failure cleanup | cfg writer reports failure but does not tear down an already working listener | later failure stopped listener and removed cfg | **Highest** |
| Listener | fixed `127.0.0.1:3000` | localhost dynamic port beginning at 32123 | Low by itself |
| GSI URI | `http://127.0.0.1:3000` | previously `http://127.0.0.1:PORT/gsi` | Custom paths are supported, but root is now used to remove a variable |
| HTTP success | any POST, 200 | authenticated `POST /gsi`, 204 | Not proven as the host failure; now root POST returns 200 while security remains |
| Authentication | none | random GSI auth token | Additional variable, but supported; retained for localhost security |
| CS2 locator | synchronous registry/default Steam roots + libraryfolders | more defensive async App 730/library locator | Unlikely primary cause because automatic and manual attempts both hit the command stall |
| Config writer | synchronous write if different, no rollback | atomic write, then could be deleted by later failure | High because rollback was coupled to settings |
| PI architecture | ordinary settings | long custom `sendToPlugin` commands for setup/diagnostics | Explains the observed PI command timeouts |
| Rat Dev link | developer linked plugin | developer linked plugin | Profile auto install issue is separate from GSI |

## New critical path

Local GSI is now deliberately independent of Stream Deck global settings:

```text
plugin process starts
→ Stream Deck connects
→ GsiHostService starts
→ load tiny local GSI state from AppData if present
→ resolve CS2 install
→ prove cfg exists and is writable
→ bind localhost listener
→ write Valve GSI config
→ persist local token/port/path in AppData as best effort
→ detect cs2.exe
→ remain listening
```

The local GSI state is stored separately at:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\state\gsi.json
```

That state contains the local GSI token/port/path only. FACEIT and Leetify keys are not written there.

If persistence of that convenience state fails, the listener and cfg stay active.

Pro only attempts the Stream Deck global settings read after local GSI setup. It has a short timeout. Failure is logged as:

```text
global settings load failed; local GSI remains active
```

Provider settings can fail without tearing down CS2 live tracking.

## GSI config contract

The generated dashboard cfg is:

```text
gamestate_integration_packrat_cs2_dashboard.cfg
```

It targets:

```text
http://127.0.0.1:PORT/
```

The production server accepts the root URI and legacy `/gsi` during migration. It remains bound only to `127.0.0.1`, retains the random auth token, rejects non CS2 App ID payloads, and caps request bodies.

The requested data remains the normal player subset. No observer only allplayers, grenade, or countdown feed is requested.

## Persistent observability

The plugin now creates this log independently of the Property Inspector:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard.log
```

The build prints that path during `rat dev`.

The log records at least:

* plugin process start, PID, version, plugin directory, Node/platform
* Stream Deck connection start/success/failure
* global settings read state without logging provider secrets
* automatic GSI setup start
* Steam candidates and selected Steam/library/CS2/cfg path
* cfg existence and write probe
* listener bind attempts, chosen port, actual URL
* config target/write success or failure
* CS2 process state
* first incoming GSI request with method/path/bytes
* JSON parsing
* auth accepted/rejected without logging the token
* provider App ID accepted/rejected
* normalization success/failure
* first GSI packet and periodic packet heartbeat
* runtime connected state
* throttled Stream Deck live key refresh start/finish/failure
* caught startup errors with stack traces
* uncaught exceptions and unhandled rejections

Normal successful packet details are throttled so a 10 Hz GSI stream cannot flood the log. Errors are always logged. The in memory diagnostic snapshot updates for every packet.

## Property Inspector diagnostics

Advanced Diagnostics is visible again, but it no longer launches a blocking `sendToPlugin` diagnostic command.

It scans only the PackRat localhost port range and reads:

```text
GET http://127.0.0.1:PORT/packrat/diagnostics
```

This returns a redacted snapshot and summary. The panel shows:

* plugin process
* Stream Deck connection
* CS2 install
* cfg state/writeability
* GSI config state
* listener URL/port
* CS2 process state
* last GSI packet
* live connected state
* last error
* persistent log path

It provides:

* Open Log Folder
* Copy Diagnostic Summary

Those controls talk to the localhost diagnostic service and do not use the old long running Property Inspector plugin command path.

If the listener fails before the endpoint becomes available, the persistent AppData log is still the fallback evidence.

## Production transport integration proof

The automated integration test starts the exact production `GsiServer`, creates the actual `DashboardRuntime`, POSTs a realistic CS2 payload to the exact root URI, and verifies:

* HTTP 200
* runtime `gsiConnected === true`
* health becomes 82
* money becomes 4250
* kills become 17
* active AK ammo becomes 22
* the live Health display becomes 82
* the diagnostic endpoint reports a packet timestamp/count

It also tests:

* legacy `/gsi`
* wrong token → 401
* wrong App ID → 400
* malformed JSON → 400
* wrong method → 405
* wrong route → 404

This proves the packaged transport/runtime path in isolation. It still does not prove that the real CS2 process on the user's machine loaded the cfg and sent the packet, which is why the Windows host gate remains required.

## Stage by stage host proof

| Runtime stage | Independent evidence after this pass |
| --- | --- |
| plugin process starts | first line of persistent AppData log |
| Stream Deck connect begins/finishes | persistent log + diagnostic snapshot |
| settings channel | persistent log shows responsive/timeout/error; not required for GSI |
| Steam/CS2 detection | persistent selected paths |
| cfg exists/writable | cfg access + temporary write/delete probe in log/snapshot |
| listener bind | log + diagnostic endpoint + listener URL |
| config generated | exact config path and root URI in log |
| CS2 process | tasklist based state in diagnostic panel/log |
| HTTP POST from CS2 | incoming request + body byte evidence |
| JSON parse | explicit success/error log |
| auth | explicit accepted/rejected log, no token value |
| App ID 730 | explicit accepted/rejected log |
| normalization | explicit first/heartbeat success or full error stack |
| runtime connected | explicit log + diagnostic state |
| key refresh | throttled `key refresh started/finished` log |

## Required Windows host gate

After the clean automated gate:

```text
rat main
rat dev cs2-competitive-dashboard
```

Do not press an Enable button.

Immediately open any dashboard Property Inspector and inspect Advanced Diagnostics.

Before CS2 launches, expected state is approximately:

```text
Plugin process     Running
Stream Deck        Connected
CS2 install        C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive
CFG folder         Found / writable
GSI config         Installed
Local listener     http://127.0.0.1:32123/   (or next available PackRat port)
CS2 process        Not detected
Last GSI packet    None
GSI connected      No
Last error         None
```

If CS2 was already open when this build was first linked, close it fully once and reopen it so Valve loads the new cfg.

Enter Deathmatch or another normal game mode.

Expected next state:

```text
CS2 process        Running
Last GSI packet    <current timestamp>
GSI connected      YES / LIVE
```

Live keys should then change from waiting state to real values.

## What to return if the host still fails

First use **Copy Diagnostic Summary** from Advanced Diagnostics and paste the full result.

Also send the full contents of:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard.log
```

If the Advanced Diagnostics panel says the localhost service is not found, the persistent log is the primary evidence. It is created at process startup before GSI bind/config setup.

Because the manifest now enables Node debugging, the latest Stream Deck managed plugin log can also be inspected afterward if the persistent log shows that the process is crashing before or during SDK connection.

Do not claim the Windows host gate passed until the real diagnostic panel shows a GSI packet arriving from CS2 and the physical Stream Deck key changes.
