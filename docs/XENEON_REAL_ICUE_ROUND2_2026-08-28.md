# XENEON Real iCUE Round 2 — 2026-08-28

This ledger records the second physical iCUE test pass after the first Marketplace recovery. Real iCUE behavior is the release authority. Emulator, runner and browser gates are supporting evidence only.

## Tester findings

### Weather Timeline Lite / Pro

Status on real iCUE: functional after supplying a WeatherAPI key.

Observed issue: iCUE preview composition looked good, but text and weather icons were much too small on the physical wide XENEON Edge display.

Recovery:

- Added a physical-device landscape sizing layer based on one height baseline.
- The override activates only on landscape viewports at least 520px tall, covering the 696px-high M/L/XL XENEON layouts while preserving the compact preview composition.
- Increased current conditions, hourly time, hourly temperature, weather icons, precipitation text, timeline heading and three-day outlook readability.
- Renamed the provider setting to `WeatherAPI Key` and made the setup copy explicit: imported widgets may not receive iCUE weather credentials, so a user-supplied WeatherAPI.com key may be required.

Final real-host retest: confirm device readability, not just preview readability.

## Work Session Tracker Lite / Pro

Status on real iCUE: functional and visually good.

Action: frozen for this recovery round. No product-code change. Pro feature expansion remains a separate product/value pass and must not destabilize the release build.

## PC Power Meter Lite

Status on real iCUE: installs, but test PC exposes no compatible iCUE power sensor. Custom Style still failed to respond.

Recovery:

- Kept the honest no-power-sensor state. Unrelated motherboard, temperature or other sensor data is never treated as wattage.
- Reordered the Custom Style triplet to `textColor`, `accentColor`, `backgroundColor` before the extra graph color.
- Added a direct 200ms binding watcher so text/accent/background/graph colors update even if iCUE delays or omits `onDataUpdated` while the widget is in the no-sensor state.
- Added a no-callback exact-package regression that changes lexical iCUE style bindings and requires the rendered CSS values to update within three seconds.

Hardware limitation: actual watt telemetry cannot be validated on a PC where iCUE exposes no `power` sensor.

## PC Power Meter Pro

Status on real iCUE: importer reported unsupported/corrupted while Lite installed.

Product-specific difference identified: Pro declares `comparisonSensors` as `sensors-factory` and used `data-default="[]"`. Current CORSAIR widget metadata guidance expects a sensor ID expression as the default for this control.

Recovery:

- Replaced the empty-array default with `plugins.Sensorsdataprovider.getDefaultSensorIdBlock('power')`.
- Applied the same Custom Style ordering and no-callback style watcher as Lite.
- Exact-package Round 2 validation rejects any regression back to `data-default="[]"`.

Final real-host retest: installation is the first gate. Sensor telemetry remains hardware-dependent.

## Desk Notes Lite / Pro

Status on real iCUE: functional. Color, accent and board rotation respond correctly. Tester considered the widgets release-ready with documentation/settings polish.

Observed polish issues:

- Checklist/card syntax was not obvious.
- Pro settings groups ran beyond the visible iCUE settings area with no useful horizontal scrollbar.

Recovery:

- Lite reduced from three groups to two: content plus `Note Settings`.
- Pro reduced from seven groups to five: four board groups plus one `Board Settings` group containing behavior, layout and Custom Style controls.
- Added syntax guidance directly to the iCUE group info.
- Added packaged `README.txt` files.

Documented syntax:

- `[ ] Task` unchecked checklist item.
- `[x] Task` starts checked.
- Blank Entry starts another note card.
- Pro: `!` pins an item, `##` creates a card heading, `#` creates a category label.

## Network Dashboard

Status on real iCUE: widget UI functional, but no latency data returned from any configured site.

Root cause: the probe transport required every arbitrary HTTPS target to grant CORS. Imported iCUE widgets execute from a local file origin, making that requirement unreliable even when the remote host is reachable.

Recovery:

- Latency probe now uses a `no-cors` opaque HTTPS request and measures request-to-response elapsed time without reading cross-origin contents.
- Successful opaque responses count as verified HTTPS response timing.
- Network failures and timeouts remain failed probes and continue to render as visible probe-loss gaps.
- UI/settings wording remains explicit that this is HTTPS response timing, not ICMP ping and not literal IP packet-loss measurement.
- Cloudflare throughput test remains separate because it must read the response body to measure transferred bytes.

Final real-host retest: confirm the primary host produces response timing in actual iCUE.

## Snake

Status on real iCUE: fully functional.

Action: frozen for this recovery round. No change.

## Round 2 release gate

Workflow: `.github/workflows/xeneon-real-icue-round2.yml`

Changed products rebuilt from exact official packages:

- `weather-timeline`
- `weather-timeline-pro`
- `pc-power-meter`
- `pc-power-meter-pro`
- `desk-notes`
- `desk-notes-pro`
- `net-dashboard`

The gate requires official validation/package creation, archive integrity, product-specific exact-package contracts, physical Weather sizing assertions, no-callback Power style updates, delayed Power Sensors lifecycle, Desk Notes settings regression, Network file-origin timing, and Corsair Labs host loading.

Physical iCUE remains the final release decision after this automated evidence is green.
