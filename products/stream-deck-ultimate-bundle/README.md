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
