# Stream Deck Ultimate Bundle

Windows hardware prototype for the PackRat flagship general-purpose Stream Deck product.

## Purpose

Prove the integrated UX before scaling scope. This is intentionally not a Marketplace release candidate yet.

## Prototype surface

- Smart App: launch or focus an existing app
- Workspace: launch/focus up to three apps and arrange them
- Window Control: left, right, maximize, next monitor
- Clipboard Slot: four recent local text entries with key previews
- Capture: Windows region capture
- Media Control: mute, volume, play/pause
- Ready-made 15-key standard Stream Deck profile

## Default 15-key layout

Row 1: WORK | BROWSER | CHAT | MUSIC | CAPTURE

Row 2: LEFT | RIGHT | MAX | NEXT MONITOR | MUTE

Row 3: CLIP 1 | CLIP 2 | CLIP 3 | CLIP 4 | PLAY

## Hardware QA history

### v0.1 — failed physical test

Observed on a real Stream Deck:

- plugin installed and actions appeared in the Stream Deck action list
- no action executed when pressed
- bundled profile did not auto-load
- placeholder icon language was visually too generic for a flagship product

Root causes found after the hardware test:

1. Runtime used a browser-style global `WebSocket` while the manifest targeted the Stream Deck Node 20 runtime. The manifest/package validator did not execute the plugin process, so the package could validate while the runtime immediately failed.
2. The generated V2 profile used a raw page UUID as its `Profiles/<page>` directory instead of the encoded V2 page-folder ID expected by current Stream Deck profiles. The profile also contained an unnecessary specific device-model binding.
3. CI treated manifest/package validation as sufficient and had no runtime WebSocket smoke gate or deterministic profile-internal validation.

### v0.2 — current hardware candidate

Changes:

- explicit `ws` runtime dependency
- Node 20 bootstrap in `bin/plugin.cjs`
- Windows CI runtime test starts the plugin, connects it to a simulated Stream Deck host, verifies registration, sends `willAppear`, and verifies key-state output
- second runtime smoke test also runs in the packaging job
- V2 profile generator now uses an encoded page-folder ID, omits brittle device-model binding, embeds all 15 custom key images, and validates its internal mapping before packaging
- deterministic icon system replaced with heavier graphite/white keys and restrained PackRat green accents
- official Elgato CLI validation and packaging remain required after all runtime/profile gates

Release rule: never hand a future hardware candidate to the user if the Windows runtime smoke test, profile structure test, official validator, or official pack step is not green.

## Existing PackRat code to reuse before production

The hardware prototype deliberately proves the integrated interaction first. The production implementation should then consolidate shared/proven code from existing PackRat products rather than permanently fork it:

- Clipboard Manager / Pro
- Window Manager Lite / Pro
- Workflow Automation Lite / Pro
- Better Hotkeys & Mouse / Pro

## Deferred until the base interaction passes hardware testing

- audio device switching
- per-application volume
- true microphone state
- Focus and Meeting modes
- adaptive context layer
- first-run app scan/onboarding
- Stream Deck+ dials and touch strip
- XL, Neo, Mini and other hardware layouts
- macOS parity
- production helper/installer
- Marketplace art and final naming

## Product naming

Working prototype name: `Stream Deck Ultimate Bundle`.

Elgato brand usage requires `Stream Deck` as two words. Final Marketplace naming remains open until the product thesis is proven on hardware.
