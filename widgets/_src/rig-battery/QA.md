# Peripheral Battery Panel QA

## Build state

Product: Peripheral Battery Panel

Slug: `rig-battery`

Branch: `product/rig-battery`

Manifest author: `PackRat 🐀`

Widget ID: `com.packrat.rigbattery`

Version: `1.0.0`

Price target: `$6.99`

## Product behavior

PASS: automatic two phase Sensors provider discovery filters to `battery-charge` and `battery-status` before requesting full metadata.

PASS: device labels use `getSensorDeviceName()` first, sensor name second, and a localized wireless device fallback last.

PASS: duplicate device names are paired by provider enumeration order and numbered deterministically rather than merged.

PASS: explicitly disconnected battery sensors are excluded.

PASS: cards sort lowest numeric charge first, then unknown charge, then device name.

PASS: charging state is independent from charge level and uses a lightning glyph, text badge, patterned fill, and optional motion. Reduced motion keeps persistent noncolor cues.

PASS: low battery threshold is user configurable from 5 to 50 percent with a default of 20 percent.

PASS: tap toggles each card from percentage to provider backed battery detail. Remaining time appears only when the provider explicitly supplies a parseable time value. The widget never derives battery life from charge percentage.

PASS: sensor value changes update the affected card and preserve lowest first sorting. Sensor add, remove, data, and units signals schedule reconciliation.

PASS: a 30 second reconciliation scan protects against missed sensor events.

PASS: last successful live card data is stored per widget instance for the intentional last known readings state.

PASS: a successful zero battery scan clears previous cached devices, so stale peripherals cannot reappear after iCUE later becomes unavailable.

PASS: successful enumeration with no battery sensors produces a dedicated no battery sensors state rather than a blank panel.

PASS: missing Sensors provider produces a dedicated unavailable state and automatic retry path.

## Deterministic browser QA

PASS: S horizontal 840 by 344.

PASS: S vertical 696 by 416.

PASS: M horizontal 840 by 696.

PASS: M vertical 696 by 840.

PASS: L horizontal 1688 by 696.

PASS: L vertical 696 by 1688.

PASS: XL horizontal 2536 by 696.

PASS: XL vertical 696 by 2536.

PASS: Small layouts intentionally show only the two lowest charge devices.

PASS: larger layouts retain all fixture devices with internal scrolling when needed.

PASS: visible card touch targets stay above 56 pixels in both dimensions.

PASS: zero document overflow in all eight product fixtures.

PASS: duplicate names, low state count, charging state count, ordering, card tap behavior, explicit provider ETA, empty state, unavailable state, disconnected sensors, and nonbattery filtering are covered by deterministic fixtures.

PASS: visual product review covered S horizontal, M horizontal, XL horizontal, and XL vertical before release automation.

## Structure and localization QA

PASS: canonical inline build regenerates the shipping index.

PASS: authored JavaScript parses cleanly.

PASS: manifest, submission metadata, translations, and Rat Art config parse cleanly.

PASS: manifest uses exact author `PackRat 🐀`, `dashboard_lcd`, Windows, `interactive: true`, and only the Sensors provider dependency.

PASS: the widget contains no HTTP, HTTPS, WS, or WSS calls and no module scripts.

PASS: iCUE property names do not collide with element IDs.

PASS: Appearance is the final settings group.

PASS: all literal translation keys are present in English, German, Spanish, and French.

PASS: customer package content is limited to the generated index, manifest, translations, and icon resource.

## Canonical release gate

PASS: GitHub Actions resolved the product slug as `rig-battery`.

PASS: canonical source regenerated into the shipping widget on a clean Windows runner.

PASS: official CORSAIR `icuewidget-cli@0.4.47` validation accepted Peripheral Battery Panel 1.0.0.

PASS: official CORSAIR packaging created the `.icuewidget` archive.

PASS: StreamSpell independently loaded the official package, reported validation passed, rendered all eight official XENEON presets, and reported no console errors or sandbox network blocks.

PASS: deterministic Rat Art captured the actual widget at all eight native slots plus the touch detail variant.

PASS: canonical Rat Art rendered five 1920 by 960 marketplace images with image generation disabled.

PASS: visual review of the Rat Art hero and contact sheet is approved in `ART_REVIEW.md`.

PASS: Rat Ship rebuilt and validated the official package, regenerated deterministic art, rendered the search icon, built the Maker Console SHIP_KIT, passed the local bridge preflight, and passed product metadata and file invariants.

## Release status

Status: `RELEASE CANDIDATE`

Physical XENEON Edge testing is optional additional confidence under the canonical RatPack release policy and is not a release candidate blocker.

The remaining boundary is promotion to `main` and the authenticated Maker Console submission step.
