# PC Power Meter Pro QA Plan

This checklist is intentionally written before the final release gate so the evidence is explicit rather than reconstructed afterward.

## Power math

The shared power math suite must pass for constant load, linear ramps, zero watts, W/kW/mW parsing, negative and unknown-unit rejection, irregular intervals, duplicate timestamps, stale gaps, midnight splitting, electricity cost, long sessions, high power, and Wh/kWh display.

## Sensor lifecycle

Deterministic fixtures cover primary total-power-draw telemetry, CPU package comparison, GPU-named power comparison, duplicate PSU labels, non-power filtering, zero watts, 12.5 kW high power, selected sensor disappearance, exact-sensor reconnect, empty power catalogue, missing Sensors provider, and Preview Mode.

The selected primary sensor must never silently become a different power sensor while disconnected.

## Accounting and persistence

Primary sensor only drives session energy, session average, peak, daily energy, cost, and history.

Comparison sensors stay separate and never contribute to the primary energy total.

Restarted sessions may resume stored totals when recent, but last-sample continuity is cleared so offline time cannot be integrated.

Finalized sessions are archived locally. Daily totals are local and bounded.

## Display

All eight native XENEON sizes must render with zero document overflow.

Normal Pro captures must show three distinct measured graph traces when primary, CPU and GPU power sensors are configured.

High power must remain representable without clipping and must activate the configured threshold state.

## Packaging

Canonical inline generation, official CORSAIR validation/package, packaged power-math smoke, StreamSpell packaged preview, deterministic Rat Art, Rat Ship kit, and product metadata invariants must all pass before release-candidate status.
