# XENEON EDGE Ultimate QA

## Release status

**HARDWARE RETEST REQUIRED BEFORE MARKETPLACE RELEASE.**

Current candidate: `1.0.2`.

Validated product commit: `edabf2502b8175983b82e2f7c765be174348e784`.

Marketplace review of 1.0.1 confirmed that the provider-independent startup correction was sufficient for reviewers to reach and interact with the widget, but exposed three release-blocking settings issues:

- Custom Style colors did not update reliably in real iCUE
- changing the layout did not reliably change the displayed screen, and the reviewer requested a dropdown instead of the cramped multi-button control
- CPU/GPU sensor roles were auto-selected only, with no manual correction when iCUE chose the wrong sensor

1.0.2 addresses those three review items while preserving the 1.0.1 fail-soft startup architecture.

## 1.0.2 Marketplace review corrections

### Real-iCUE settings propagation

The widget now includes a direct real-iCUE settings watcher for all important XENEON bindings. It reads the RatPack direct-binding bridge rather than depending only on legacy `window` properties or assuming that `icueEvents.onDataUpdated()` will always arrive exactly when expected.

The watcher covers:

- preset
- layout / start mode
- Smart Mode
- time and temperature settings
- weather/calendar/focus/note settings
- graph window
- four manual PC sensor selectors
- text, accent and background Custom Style colors

Custom Style also updates the supporting muted/panel palette so the result looks fully themed rather than only changing a few primary elements.

### Layout control

The previous `Start Mode` tab-button row is now a native iCUE `combobox` labeled **Layout**.

Available selections remain:

- Auto
- Home
- Performance
- Today
- Ambient

A selection change is applied to the active screen immediately. Smart Mode behavior remains available through Auto.

### Manual PC sensor selection

1.0.2 adds native iCUE `sensors-combobox` controls for:

- CPU Temperature Sensor
- GPU Temperature Sensor
- CPU Load Sensor
- GPU Load Sensor

The selected sensor IDs override automatic role detection. When a selected sensor is unavailable, the widget can fall back to the automatically discovered role rather than manufacturing or relabeling telemetry.

Changing a selected sensor clears stale role data/history before the new source is used.

## Preserved 1.0.1 startup correction

The earlier physical failure was caused by shell readiness being held behind native provider initialization. 1.0.1 changed startup so provider I/O cannot block the interactive shell:

- bind navigation, touch and click handlers first
- apply the local UI and clock before provider work
- render the dashboard shell
- start timers
- mark the runtime ready
- only then initialize Sensors, FPS, Media, Network, Weather and Calendar
- initialize optional providers independently so one failure cannot freeze the dashboard
- retain provider/runtime warnings without converting optional-data failure into UI failure

That architecture is unchanged in 1.0.2.

Historical 1.0.1 stalled-provider evidence remains useful: the exact 1.0.1 package reached `data-runtime=ready` in 345 ms while the Sensors provider was deliberately left unresolved, with navigation and settings still responsive. 1.0.2 does not move provider work back into the blocking shell bootstrap.

## Verified 1.0.2 release evidence

### Exact package and host gate

GitHub Actions XENEON Widget CI run `33896801470` passed on merged product commit `edabf2502b8175983b82e2f7c765be174348e784`.

Verified steps include:

- canonical source regeneration with `tools/xeneon/inline.py`
- official `icuewidget-cli@0.4.47` validation
- official `.icuewidget` package creation
- exact package integrity checks
- lexical real-iCUE Custom Style regression
- RatPack direct-binding bridge v2 present with all 1.0.2 settings, including the four sensor selectors
- Custom Style text/accent/background values applied to CSS and body styling
- Corsair Labs exact-package host/settings smoke
- actual Performance → Today → Ambient → Home mode interaction smoke
- no page or console errors
- packaged network smoke
- StreamSpell packaged preview

An additional exact-package review smoke performed during the 1.0.2 repair changed real-iCUE-style lexical bindings without manually invoking `icueEvents.onDataUpdated()`. The watcher applied the new colors, layout and all four sensor-role IDs automatically with no runtime errors. This directly targets the lifecycle gap observed by CORSAIR review.

### Rat Art

GitHub Actions Rat Art run `33896803539` passed on the merged 1.0.2 candidate:

- canonical shipping rebuild
- native XENEON captures
- deterministic canonical Rat Art rendering
- Rat Art contract verification
- isolated candidate artifact upload

### Rat Ship

GitHub Actions Rat Ship run `33896805344` passed on the merged 1.0.2 candidate:

- local Rat command/parser validation
- official CORSAIR validation
- official `.icuewidget` packaging
- deterministic product captures
- deterministic Rat Art
- deterministic 288x288 search icon
- Maker Console SHIP_KIT generation
- Playwright Maker Console driver preflight
- Rat Ship invariants
- final ship-kit artifact upload

A green Rat Ship result is packaging evidence only. It does **not** override the required physical-hardware retest below.

## Static and API honesty gates

- Source is XML-safe after RatPack inlining.
- Authored JavaScript passes syntax validation.
- No remote JavaScript or stylesheet dependencies.
- Custom Style triplet remains `textColor`, `accentColor`, `backgroundColor`.
- Manual PC telemetry selectors use native `sensors-combobox` controls.
- Required plugin declarations match the documented iCUE provider module/plugin/version strings.
- Native telemetry is limited to values exposed by the iCUE providers.
- The product does not claim native 1% lows, true frametime, album artwork, media progress, ICMP ping or literal packet loss.
- Browser network measurements remain explicitly described as HTTPS response timing.
- Weather and calendar fail closed when configuration or network access is unavailable.
- Preview, CI and Rat Art fixtures never become shipping telemetry.

## Eight-slot layout contract

Supported compositions remain:

- 840x344 S horizontal
- 696x416 S vertical
- 840x696 M horizontal
- 696x840 M vertical
- 1688x696 L horizontal
- 696x1688 L vertical
- 2536x696 XL horizontal
- 696x2536 XL vertical

The desk-distance readability pass remains included in 1.0.2.

## Mandatory physical 1.0.2 retest

Before Marketplace resubmission, install the exact 1.0.2 package on a physical XENEON EDGE after removing the previous Ultimate installation. Confirm all of the following:

1. Change Text Color, Accent Color and Background Color in Custom Style. Each must update on-screen immediately without clicking away and back.
2. Verify **Layout** is presented as a readable dropdown in iCUE.
3. Change Layout through Home → Performance → Today → Ambient → Auto. Each manual selection must change the displayed screen immediately.
4. Manually choose CPU Temperature, GPU Temperature, CPU Load and GPU Load sensors from the new iCUE sensor dropdowns. Confirm the intended readings populate and changing a selector changes the source rather than snapping back to auto-selection.
5. Confirm the shell becomes interactive immediately even if telemetry has not populated yet.
6. Confirm physical touch navigation and mouse click navigation still work.
7. Confirm clock/UI continue updating while optional providers initialize.
8. Confirm FPS behavior updates when a supported foreground application is active.
9. Confirm Smart Mode and manual hold/resume still work.
10. Confirm changing XENEON widget size/orientation adapts the layout without freezing the runtime.
11. Confirm unavailable optional weather/calendar/network data does not make navigation unresponsive.
12. Restart iCUE and verify the chosen settings remain effective after reload.

The first four items correspond directly to CORSAIR's 1.0.1 review feedback and are the mandatory acceptance criteria for this resubmission.

Marketplace submission remains a separate authenticated action. `marketplace_auto_publish` remains false. Do not submit or publish until this physical 1.0.2 retest passes.
