---
name: icue-widget-builder
description: Build, test, package, and validate CORSAIR iCUE widgets including XENEON Edge dashboard LCD products.
---

# iCUE Widget Builder

Read `platforms/icue-xeneon.md` before implementation.

This canonical skill preserves the proven local workflow while the full vendor reference bundle is migrated into this repository.

## Product contract

Target the current iCUE Widget API and declare the correct supported device class. XENEON Edge uses the dashboard LCD class.

Keep authored source separate from final shipping output when the vendor package command archives the package folder wholesale.

The current factory pattern is authored source under `_src/<slug>` and a flattened shipping directory generated from that source.

Do not remove the inline flattening step merely because external scripts work in a normal browser. The real iCUE host has different local loading behavior.

## Build path

source -> inline build -> structural checks -> browser fixtures -> responsive checks -> functional checks -> deterministic captures -> art -> vendor validate -> vendor package -> release artifact.

## Layout

Test every supported size and orientation used by the product. Treat text clipping, overflow, touch target issues, missing provider state, and blank layouts as failures.

The public platform currently cannot reliably restrict an imported dashboard LCD widget to one exact XENEON slot size or orientation. Treat that as a platform limitation, not a product bug.

## Providers

Use only the iCUE providers the product actually needs. Validate sensor, media, FPS, device action, link, or Stream Deck provider behavior with deterministic fixtures before real host testing.

Do not put secrets in client side widget source.

## Common tools

If the widget depends on CORSAIR common tools, vendor the required approved common resources into the product rather than assuming a machine global install path.

## Art

Marketing art must use real deterministic widget captures from the browser harness. Missing captures are a hard failure.

## Packaging

Run vendor validation before package creation. Prefer a clean Windows GitHub Actions runner once unattended installation of the iCUE Widget CLI is proven.

## Final local boundary

Use local iCUE and the physical XENEON Edge only for final import, exact device rendering, touch behavior, host provider behavior, and physical inspection.
