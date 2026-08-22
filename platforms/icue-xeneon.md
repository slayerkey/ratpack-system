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

source -> inline build -> structural checks -> browser fixtures -> responsive checks -> functional checks -> deterministic shots -> art -> iCUE CLI validate -> iCUE CLI package -> artifact.

Use a Windows CI runner for the vendor CLI once clean runner installation is proven.

## Art requirement

Widget marketing must use real deterministic widget captures. Missing captures are a hard failure.

## Final local boundary

Import into iCUE, verify exact device rendering, verify touch behavior, verify provider behavior with the real host, and inspect the physical XENEON Edge.
