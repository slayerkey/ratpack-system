# CORSAIR iCUE and XENEON Edge

The canonical skill is `skills/icue-widget-builder/SKILL.md`.

## Canonical PackRat identity

Every PackRat XENEON/iCUE widget manifest must use the exact author string `PackRat 🐀`.

Do not use `Packrat 🐀`, `Packrat`, or other capitalization variants for new widget manifests.

The reverse domain product namespace remains `com.packrat.<product>` unless an existing published identifier must be preserved.

## Product structure

Keep authored widget source outside the final package directory when package tooling archives the package folder wholesale.

The current factory uses `_src/<slug>` as authored source and an inline step to produce the shipping folder.

The inline step is not cosmetic. Current host behavior can fail on external script loading from local widget paths, so the shipping artifact is intentionally flattened.

## Automated path

source -> inline build -> structural checks -> browser fixtures -> responsive checks -> functional checks -> deterministic shots -> art -> official iCUE CLI validate -> official iCUE CLI package -> StreamSpell packaged preview -> artifact.

Use GitHub Actions as the normal clean execution environment for the vendor CLI and packaged preview.

## Verification tiers

1. Source and structure checks catch silent host failures such as XML head problems, translation drift, invalid settings metadata, and non self contained shipping files.
2. The RatPack browser harness renders all eight official XENEON Edge slot sizes with deterministic provider fixtures and checks overflow, typography, interaction, and runtime errors.
3. The official `icuewidget` CLI validates and packages the shipping directory. This is mandatory because StreamSpell hosted validation is intentionally limited.
4. StreamSpell's `xeneon-edge-widget-builder` loads the produced `.icuewidget`, independently extracts it, validates its package structure, and renders the official XENEON viewport presets. The canonical automation is `tools/xeneon/streamspell.mjs`.
5. Real iCUE or physical hardware testing is extra confidence when available. The current PackRat workflow does not own a physical XENEON Edge, so lack of hardware alone is not a release blocker after the four automated tiers above pass.

StreamSpell is an independent approximation, not a physical device. Its hosted preview runs in a sandboxed browser and does not emulate local iCUE providers. For provider based widgets, use deterministic RatPack fixtures for behavior and StreamSpell for package and layout verification.

The hosted StreamSpell flow uploads the package to a third party service. Only use it for packages that contain no secrets or confidential data.

## Art requirement

Widget marketing must use real deterministic widget captures. Missing captures are a hard failure.

StreamSpell screenshots are verification evidence, not listing art. Marketplace artwork must continue to use the deterministic RatPack capture pipeline at native slot resolutions.

## Release boundary

A XENEON widget may reach release candidate without a physical XENEON Edge when all automated verification tiers pass and the feature does not depend on an untested external transport.

If compatible hardware or a real iCUE host becomes available, run it as an additional smoke test rather than treating it as the place where ordinary code, layout, or packaging bugs should first be discovered.
