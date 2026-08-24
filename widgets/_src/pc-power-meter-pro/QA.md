# PC Power Meter Pro QA

## Build state

Product: PC Power Meter Pro

Slug: `pc-power-meter-pro`

Release branch: `product/pc-power-meter-pro-clean`

Widget ID: `com.packrat.pcpowermeterpro`

Version: `1.0.0`

Price target: `$7.99`

Evidence commit: `b8919c4826ec427688dadeee75c604884d6b9e03`

## Feasibility and measurement contract

PASS: official iCUE Sensors Data Provider supports the `power` sensor type and exposes sensor kind, device/name metadata, units, connectivity, enumeration and live sensor signals.

PASS: whole-PC wording is used only when iCUE exposes `total-power-draw`. CPU `package`, PSU `power-in` and PSU `power-out` remain explicitly scoped.

PASS: the primary selected power sensor alone drives authoritative session energy, average, peak, daily energy, cost and history.

PASS: comparison sensors remain separate traces/readings and are never summed into a manufactured total.

PASS: idle-versus-active classification is intentionally omitted because the current provider contract does not supply a universal workload-state signal.

## Energy math

PASS: shared power-math tests cover constant power, linear ramps, zero watts, W/kW/mW parsing, negative and unknown-unit rejection, irregular sampling, duplicate/out-of-order timestamps, stale gaps, midnight/day splitting, time-weighted averages, electricity cost, long sessions, 12.5 kW input and Wh/kWh formatting.

PASS: energy uses trapezoidal integration over actual elapsed milliseconds, not assumed one-second samples.

PASS: stale/disconnected/offline gaps are not backfilled.

PASS: restart persistence can keep accumulated totals while continuity is broken so offline time cannot be integrated.

## Deterministic browser QA

PASS: S horizontal 840 by 344.

PASS: S vertical 696 by 416.

PASS: M horizontal 840 by 696.

PASS: M vertical 696 by 840.

PASS: L horizontal 1688 by 696.

PASS: L vertical 696 by 1688.

PASS: XL horizontal 2536 by 696.

PASS: XL vertical 696 by 2536.

PASS: zero watts renders as a valid `0.00` reading and zero cost.

PASS: 12,500 W renders without clipping and activates the configured high-power threshold state.

PASS: Preview Mode uses deliberate synthetic preview telemetry only when iCUE identifies preview state.

PASS: missing Sensors provider renders the unavailable state.

PASS: a successful scan with no power sensors renders the empty state.

PASS: duplicate PSU labels are disambiguated deterministically as `#1` and `#2`.

PASS: normal Pro fixtures render three separate measured graph paths for primary, CPU and GPU comparison sensors.

PASS: selected primary sensor disappearance enters disconnected state instead of silently falling back to another power sensor.

PASS: exact selected sensor reconnect restores the same primary sensor without decreasing/corrupting accumulated session energy. This lifecycle check runs in dedicated `VARIANT_RECONNECT` so marketplace captures remain visually clean.

PASS: cost fixture uses 840 Wh at $0.15/kWh and renders `$0.126`.

PASS: daily energy fixture renders 1.32 kWh and previous-session history renders 620 Wh / 310 W average.

PASS: zero document overflow is enforced by the canonical capture runner for every native slot and variant.

## Canonical release gates

PASS: RatPack Context CI run `32690605175` succeeded.

PASS: XENEON Widget CI run `32690605203` succeeded. Canonical source regenerated cleanly, official CORSAIR `icuewidget-cli@0.4.47` validation passed, official packaging succeeded, packaged power-math smoke passed, and StreamSpell loaded/rendered the official package successfully.

PASS: Rat Art XENEON run `32690605160` succeeded. Real widget captures passed all eight native sizes and behavior variants before deterministic five-frame marketplace art rendered.

PASS: final Rat Art contact sheet, M_H and L_V captures were visually reviewed and approved in `ART_REVIEW.md`.

PASS: Rat Ship XENEON run `32690605171` succeeded. Official validation/package, deterministic capture/art, search icon render, Maker Console SHIP_KIT build, Playwright kit preflight and Rat Ship invariants all passed.

PASS: final SHIP_KIT contains `pc-power-meter-pro.icuewidget`, separate cover plus four distinct gallery images, 288 search icon, submission metadata, listing/release-note paste files, checklist and stage/submit helpers.

PASS: SHIP_KIT metadata is Widget, PC Power Meter Pro, version 1.0.0, price $7.99, Utilities, English, all four marketplace dashboard sizes.

## Release status

Status: `READY_TO_SHIP` / release candidate.

Automated validation, packaging, browser QA, deterministic artwork and shipping preparation are complete. Physical XENEON Edge testing is optional additional confidence under the current RatPack release policy.

Marketplace submission itself remains an authenticated/irreversible step and is not marked SUBMITTED until it actually occurs.
