# XENEON EDGE Ultimate QA

## Release status

**HARDWARE RETEST REQUIRED BEFORE MARKETPLACE RELEASE.**

Current candidate: `1.0.1`.

Validated runtime candidate commit: `c9eaf47715a6a877b18791e4576ed13d23313948`.

The 1.0.0 candidate previously passed the complete automated RatPack XENEON pipeline, but a physical XENEON EDGE test then exposed a release-blocking startup failure: the widget could render its static shell while failing to load live data, respond to touch/click, change screens, or react to widget/page changes. Because physical hardware found a failure that the previous automated contract did not reproduce, physical XENEON validation is now mandatory for this release before Marketplace submission.

## 1.0.1 startup correction

The physical symptom was consistent with startup being held behind native provider initialization. Audit of `ui-runtime.js` found a remaining blocking path: real-hardware startup still awaited Sensors discovery before the shell was marked ready. Sensor discovery can wait on host responses for multiple seconds, leaving the screen visually present but effectively inert.

The 1.0.1 runtime now enforces a fail-soft startup contract:

- bind navigation, touch and click handlers first
- apply the local UI and clock before provider work
- render the dashboard shell
- start timers
- mark the runtime ready
- only then initialize Sensors, FPS, Media, Network, Weather and Calendar
- initialize optional providers independently so one failure cannot freeze the dashboard
- clear the startup latch and retry if the actual shell bootstrap fails
- retain provider/runtime warnings without converting an optional-data failure into a UI failure

No native provider I/O is allowed to block shell readiness.

## Verified 1.0.1 release evidence

### Exact package and host gate

GitHub Actions XENEON Widget CI run `33536936947` passed on runtime commit `c9eaf47715a6a877b18791e4576ed13d23313948`:

- source regenerated with `tools/xeneon/inline.py`
- official `icuewidget-cli@0.4.47` validation
- official `.icuewidget` creation
- exact ZIP/package integrity checks
- lexical iCUE Custom Style binding regression
- Corsair Labs `iCUE-widget-runner-windows` exact-package host/settings smoke
- actual Home, Performance, Today and Ambient interaction checks
- live settings reaction without page navigation
- packaged live HTTPS response-timing smoke
- all eight XENEON viewport compositions with no overflow, no multiple visible screens, no runtime errors and no undersized product-smoke touch targets
- StreamSpell packaged-widget render across the supported XENEON presets

### Stalled-provider regression

The exact packaged 1.0.1 widget is now tested with native Sensors discovery deliberately left unresolved. This models a late or stuck iCUE provider rather than a normal fixture response.

Run `33536936947` proved:

- stalled Sensors request was actually exercised
- shell reached `data-runtime=ready` in **345 ms**, before the provider request timeout
- `state.started=true`
- UI handlers were bound
- timers were running
- Performance, Today, Ambient and Home remained clickable
- live settings continued to update
- no runtime errors occurred

Recorded smoke state:

- runtime: `ready`
- started: `true`
- uiBound: `true`
- timersStarted: `true`
- final mode: `home`
- settings sentinel: `Provider stall did not freeze shell`
- stalled sensor requests: `1`

This regression is a permanent release gate so a native provider can no longer silently reintroduce the same all-or-nothing startup dependency.

### Rat Art

GitHub Actions Rat Art run `33536940027` passed on the same runtime candidate:

- canonical shipping rebuild
- deterministic native captures across all eight XENEON compositions
- Home, Performance, Today and Ambient fixtures
- canonical Rat Art rendering
- Rat Art contract verification
- isolated candidate artifact upload

The desk-distance readability pass remains included in the 1.0.1 candidate.

### Rat Ship

GitHub Actions Rat Ship run `33536943438` passed on the same runtime candidate:

- local Rat command/parser validation
- official CORSAIR validation and package creation
- deterministic product captures and Rat Art
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
- Custom Style triplet is `textColor`, `accentColor`, `backgroundColor` in canonical order.
- Required plugin declarations match documented iCUE provider module/plugin/version strings.
- Native telemetry is limited to data the iCUE providers actually expose.
- The product does not claim native 1% lows, true frametime, album art, media progress, ICMP ping or literal packet loss.
- Browser network measurements are explicitly described as HTTPS response timing.
- Weather and calendar fail closed when configuration or network access is unavailable.
- Preview, CI and Rat Art fixtures never become shipping telemetry.

## Eight-slot layout contract

Validated compositions:

- 840x344 S horizontal
- 696x416 S vertical
- 840x696 M horizontal
- 696x840 M vertical
- 1688x696 L horizontal
- 696x1688 L vertical
- 2536x696 XL horizontal
- 696x2536 XL vertical

Earlier QA caught and corrected compact S-horizontal mode navigation and M-vertical Focus controls that were below the desired touch target. The strict packaged smoke passes all eight compositions.

## Runtime coverage

Verified or deterministically exercised states include sensor provider loading and CPU/GPU discovery, deliberately stalled sensor discovery, FPS availability and foreground process, Smart Mode entry/exit behavior, media metadata and transport wiring, configured/unconfigured weather, ICS agenda states, HTTPS network success/history, Focus controls, live style/settings updates and local persistence.

## Mandatory physical 1.0.1 retest

Before Marketplace release, install the exact 1.0.1 hardware-retest package on a physical XENEON EDGE after removing the previous Ultimate installation. Confirm all of the following:

1. The shell becomes interactive immediately even if telemetry has not populated yet.
2. Home → Performance → Today → Ambient → Home responds to physical touch.
3. Mouse click interaction also changes screens.
4. Clock/UI continue updating while providers initialize.
5. CPU/GPU telemetry eventually populates when native Sensors data is available.
6. FPS behavior updates when a supported foreground application is active.
7. A settings change applies without requiring page/widget navigation.
8. Smart Mode changes mode when appropriate and manual navigation hold/resume works.
9. Changing XENEON widget size/orientation causes the layout to adapt rather than freezing the runtime.
10. Unavailable optional weather/calendar/network data does not make navigation unresponsive.

If any of items 1 through 4 fail, stop release immediately and capture the observed state. The next diagnostic step is a minimal on-screen boot/version marker and input-only hardware build to separate host input dispatch from application/provider startup.

Marketplace submission remains a separate authenticated action. `marketplace_auto_publish` remains false. Do not submit or publish until this physical 1.0.1 retest passes and the final paid listing is explicitly reviewed.
