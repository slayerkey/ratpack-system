# CORSAIR iCUE and XENEON Edge

The canonical skill is `skills/icue-widget-builder/SKILL.md`.

## Canonical PackRat identity

Every PackRat XENEON/iCUE widget manifest must use the exact author string `PackRat 🐀`.

Do not use `Packrat 🐀`, `Packrat`, or other capitalization variants for new widget manifests.

The reverse domain product namespace remains `com.packrat.<product>` unless an existing published identifier must be preserved.

## Product structure

Keep authored widget source outside the final package directory when package tooling archives the package folder wholesale.

The current factory uses `_src/<slug>` as authored source and an inline step to produce the shipping folder.

The canonical generator is `tools/xeneon/inline.py`. CI must regenerate the shipping `widgets/<slug>/index.html` from canonical source before official validation and packaging. Do not depend on a stale checked-in build artifact.

The inline step is not cosmetic. Current host behavior can fail on external script loading from local widget paths, so the shipping artifact is intentionally flattened.

## iCUE settings bindings

iCUE widget controls are document-level JavaScript bindings. Product code must not assume that a control is always represented as a normal own property on `window` or `globalThis`.

Generated shipping HTML uses the RatPack direct-binding bridge from `tools/xeneon/inline.py`. The bridge statically references every declared `x-icue-property`, exposes live compatibility getters only when a host binding exists, and avoids dynamic `Function` or eval based property discovery.

The lexical-binding regression in `tools/xeneon/native-style-smoke.mjs` is mandatory for widgets that declare the XENEON Custom Style triplet. A browser or compatibility runner that writes settings directly onto `window` is not sufficient evidence by itself.

## Typography safety

Text that lives inside a clipping or marquee viewport must reserve real glyph room, including descenders and overshoot. Do not use compressed line heights that visibly crop letters such as `g`, `y`, `p`, `q`, or `j`.

For large display titles inside `overflow: hidden`, use a descender-safe line height of at least `1.0` unless explicit tested padding provides equivalent ink clearance. Visual QA fixtures should include descender-heavy sample text so this class of defect is caught before Rat Art captures are generated.

Marketing art must inherit the real corrected widget render. Never patch clipped product typography in the marketplace image itself.

## Automated path

source -> inline build -> structural checks -> browser fixtures -> responsive checks -> functional checks -> deterministic shots -> art -> official iCUE CLI validate -> official iCUE CLI package -> exact package extraction -> lexical iCUE settings smoke -> Corsair Labs Windows runner smoke -> StreamSpell packaged preview -> artifact.

Use GitHub Actions as the normal clean execution environment for the vendor CLI, Corsair Labs runner smoke, and packaged preview.

## Verification tiers

1. Source and structure checks catch silent host failures such as XML head problems, translation drift, invalid settings metadata, and non self contained shipping files.
2. The RatPack browser harness renders all eight official XENEON Edge slot sizes with deterministic provider fixtures and checks overflow, typography, interaction, and runtime errors.
3. The official `icuewidget` CLI validates and packages the shipping directory. CI then opens the exact produced `.icuewidget`, checks ZIP integrity, and requires root `index.html` and `manifest.json` before any downstream host test.
4. The RatPack lexical-binding smoke verifies XENEON Custom Style updates using document-level bindings rather than `window` properties. This is the regression gate for the Marketplace failure class where settings appear in iCUE but do not affect the widget.
5. Corsair Labs `iCUE-widget-runner-windows` loads the exact extracted official package on a Windows GitHub runner and exercises the widget through its iCUE compatibility host. The canonical automation is `tools/xeneon/icue-runner-smoke.mjs`.
6. StreamSpell's `xeneon-edge-widget-builder` loads the produced `.icuewidget`, independently extracts it, validates its package structure, and renders the official XENEON viewport presets. The canonical automation is `tools/xeneon/streamspell.mjs`.
7. Real iCUE or physical hardware testing remains the highest confidence host/device smoke when available.

The Corsair Labs runner is experimental software, not the real iCUE runtime. Its current compatibility shim assigns property values onto the widget `window`, so it can be more permissive than real iCUE for settings binding behavior. Treat it as a valuable Windows host and interaction layer, but never let it replace the lexical-binding regression or a real iCUE smoke when one is available.

StreamSpell is an independent approximation, not a physical device. Its hosted preview runs in a sandboxed browser and does not emulate local iCUE providers. For provider based widgets, use deterministic RatPack fixtures for behavior and StreamSpell for package and layout verification.

The hosted StreamSpell flow uploads the package to a third party service. Only use it for packages that contain no secrets or confidential data.

## Art requirement

Widget marketing must use real deterministic widget captures. Missing captures are a hard failure.

Corsair runner and StreamSpell screenshots are verification evidence, not listing art. Marketplace artwork must continue to use the deterministic RatPack capture pipeline at native slot resolutions.

## Release boundary

A XENEON widget may reach release candidate without a physical XENEON Edge only when all applicable automated verification tiers pass and the feature does not depend on an untested external transport.

A product with user facing iCUE controls must not be marked Marketplace ready merely because browser fixtures or StreamSpell pass. Its exact package must pass the lexical settings gate and Corsair Labs runner gate as applicable.

If compatible hardware or a real iCUE host becomes available, run it as an additional smoke test rather than treating it as the place where ordinary code, layout, settings, or packaging bugs should first be discovered.
