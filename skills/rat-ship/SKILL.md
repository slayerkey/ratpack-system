---
name: rat-ship
description: Prepare a verified Packrat release candidate, marketplace kit, and submission checklist after QA is clean.
---

# Rat Ship

Require a clean automated QA report before preparing submission.

Create the release candidate from canonical source and generated artifacts. Include package, listing art, description, tags or keywords, pricing evidence, compatibility, version, changelog or release notes, QA report, and gallery order where the marketplace needs it.

Validate that the ship helper has an explicit branch for the product type. Do not let widgets fall through to profile handling.

Treat irreversible fields such as product ID, paid versus free selection, and final publication state as explicit submission decisions.

Under the current system, Maker Console automation depends on an authenticated local Chromium profile. Do not copy that credential into GitHub or CI.

Advance to SUBMITTED only after the actual marketplace submission has occurred.
