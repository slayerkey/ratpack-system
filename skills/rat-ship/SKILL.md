---
name: rat-ship
description: Prepare a verified PackRat release candidate, marketplace kit, and submission checklist after QA is clean.
---

# Rat Ship

Require a clean automated QA report before preparing submission.

Create the release candidate from canonical source and generated artifacts. Include package, listing art, description, tags or keywords, pricing evidence, compatibility, version, changelog or release notes, QA report, and gallery order where the marketplace needs it.

Validate that the ship helper has an explicit branch for the product type. Do not let widgets fall through to profile handling.

## XENEON marketplace media

For XENEON widgets, treat the cover and gallery as separate customer jobs.

The default marketplace order is:

1. Cover or hero
2. Feature and value breakdown
3. Product showcase
4. Settings, interaction, or alternate state
5. Slot size compatibility

Do not upload the cover again as a gallery item. The ship kit must fail if the cover or any gallery image is byte identical to another listing image.

The first gallery frame should normally explain the product in more detail with concise feature or value points rather than repeat the hero composition.

Use the shared Rat Art footer and spacing rules. Do not add product-local footer wordmarks or one-off label/divider placement fixes when the shared renderer can own them.

## Elgato Maker Console

Use the live Maker Console behavior as the operational source of truth when it conflicts with lagging public documentation.

PackRat has directly confirmed that `Widget` is a selectable Maker Console product type and that the create-product flow accepts `.icuewidget` packages. Do not route iCUE/XENEON widgets to email merely because the public supported-product list omits Widget.

For widgets, the canonical submission path is Maker Console when the live UI offers `Widget`.

The existing Maker Console automation uses Playwright with a local persistent Chromium profile. Authentication remains local. Never copy browser profile data, cookies, passwords, or session tokens into GitHub, GitHub Actions, repository files, or CI secrets for this workflow.

Prefer the canonical local Playwright driver under `tools/ship/` for repeatable staging and upload. The driver must fail closed when required widget-specific fields are unknown rather than guessing.

Treat irreversible fields such as product ID, name, paid versus free selection, price, gallery order, and final publication state as explicit submission decisions. Verify them immediately before the final submit action.

Advance to SUBMITTED only after the actual marketplace submission has occurred.
