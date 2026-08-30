# Stream Deck Ultimate Bundle

Windows hardware prototype for the PackRat flagship general-purpose Stream Deck product.

## Purpose

Prove the integrated UX before scaling scope. This is intentionally not a Marketplace release candidate yet.

## Prototype surface

- Smart App: focus an existing app or launch it
- Workspace: launch/focus up to three apps, wait for windows, and arrange them
- Window Control: left, right, maximize, next screen
- Clipboard Slot: recent local text entries without content previews on the key
- Capture: Windows region capture
- Media Control: mute, volume, play/pause
- Ready-made 15-key standard Stream Deck profile

## Default 15-key layout

Row 1: WORK | BROWSER | DISCORD | SPOTIFY | CAPTURE

Row 2: LEFT | RIGHT | MAX | NEXT SCREEN | MUTE

Row 3: CLIP 1 | CLIP 2 | VOL - | VOL + | PLAY

## Hardware QA history

### v0.1 — failed physical test

Observed on a real Stream Deck:

- plugin installed and actions appeared in the Stream Deck action list
- no action executed when pressed
- bundled profile did not become usable
- placeholder icon language was visually too generic for a flagship product

The test exposed a missing runtime gate and malformed generated profile structure. CI was upgraded so a package is no longer considered test-ready simply because the manifest validates.

### v0.2 — second physical test

Observed on a real Stream Deck:

- runtime now executes
- LEFT works
- CAPTURE works
- WORK successfully opened Spotify and Discord, but browser behavior was unreliable
- manually added Smart App/browser action could fail and show Stream Deck's generic danger indicator
- clipboard content preview overflowed the small key and made the key visually noisy
- icon system was still too decorative/complex
- bundled profile did not appear again after updating an already-installed plugin

Important product behavior confirmed from Elgato documentation: bundled profiles are installed on first plugin install, but profiles are intentionally not automatically updated/overwritten later because users may customize them. Development builds therefore ship the current `.streamDeckProfile` separately for manual import when layout changes.

### v0.3 — current hardware candidate

Changes based directly on v0.2 physical feedback:

- much simpler key language: black background, one large white pictogram, short title; no decorative key border and no static green accent on every key
- clipboard keys no longer render copied text/URLs on the key
- browser detection expanded to Program Files, Program Files (x86), and LocalAppData locations for Chrome/Edge plus Firefox, Brave, and Opera
- browser has a default-browser URL fallback rather than ending in a dead action when no known executable is found
- Smart App uses stronger Windows foreground activation and shows OPEN / FOCUS / ACTIVE / NOT FOUND / FAILED feedback instead of a generic danger icon
- Workspace waits for real application windows before arranging them instead of relying on one fixed sleep delay
- clipboard paste path switched to local Set-Clipboard + WScript SendKeys and reports EMPTY / PASTED / FAILED explicitly
- V2 profile custom-image reference corrected to `state0.png` relative to each key's CustomImages directory
- V2 page-folder encoding, 15-key image presence, image dimensions, and action UUIDs are validated before packaging
- Windows CI now executes a real Smart App action using Notepad, in addition to WebSocket registration and rendered-state tests
- official Elgato CLI validation and packing remain mandatory after all runtime/profile gates

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
