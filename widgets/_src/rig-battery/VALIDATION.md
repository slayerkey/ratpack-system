# Peripheral Battery Panel validation

Status: `RELEASE CANDIDATE`

Price: `$6.99`

## Customer problem

Wireless peripherals die at the least useful time, and battery state is easy to miss when it lives only inside iCUE. XENEON Edge is a persistent output surface, so it is a natural place to keep battery state visible without opening another app.

## Feasibility

The iCUE Sensors Data Provider exposes battery charge and battery status sensor types plus enumeration, device names, units, values, connection state, and live change signals.

The widget therefore stays entirely local. It needs no external API, account, helper app, token, or network host.

The provider does not document a dedicated remaining time method or a stable device identifier for grouping. The product does not invent either capability. Remaining time is displayed only when provider text explicitly contains a time value, and duplicate device names are paired deterministically by enumeration order.

## Positioning

The product is not a generic sensor monitor. It is a battery first panel that automatically discovers supported Corsair wireless devices, sorts the lowest charge first, makes charging state visually independent from charge percentage, and intentionally keeps only the two most urgent devices on Small layouts.

## Product scope

Version 1.0.0 includes automatic battery sensor discovery, device labels, lowest charge first sorting, charging state treatment independent of percentage, configurable low battery threshold, touch battery detail, explicit empty and unavailable states, last known readings, and all eight official XENEON slot layouts.

## Proven release gate

PASS: deterministic product fixtures cover the battery provider behaviors and all eight slot geometries.

PASS: official CORSAIR CLI validation and packaging completed on a clean GitHub Actions Windows runner for `rig-battery`.

PASS: StreamSpell independently accepted the official package and rendered all eight XENEON presets with no console errors.

PASS: deterministic Rat Art captured the actual widget and produced the required marketplace media with image generation disabled.

PASS: visual Rat Art review is approved.

PASS: Rat Ship produced a complete Maker Console kit and passed its package, metadata, media, and local bridge preflight invariants.

## Residual risks

1. Different Corsair devices may expose `battery-status` values differently. The parser is deliberately conservative and does not fabricate unsupported states.
2. Duplicate device names have no documented stable grouping identifier. The widget preserves deterministic provider order and numbered labels instead of guessing from undocumented sensor IDs.
3. Real XENEON hardware may still reveal host specific behavior that deterministic browser, official CLI, and packaged StreamSpell checks cannot reproduce. Hardware testing is optional additional confidence, not a release candidate blocker.

## Verdict

Release candidate at `$6.99`.

The product is local, low maintenance, useful on a persistent display, and differentiated enough from general sensor widgets to justify a standalone release.
