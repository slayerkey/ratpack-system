# XENEON Marketplace Recovery — 2026-08-27

This document is the durable recovery ledger for the August 27, 2026 CORSAIR XENEON Edge Marketplace rejection batch.

It records reviewer feedback, product identifiers, root causes, fixes, verification evidence, and remaining manual requirements. Do not mark a product `submitted` from this document alone. `qa_passed` means the repaired package passed RatPack's hardened exact-package QA and is ready for a Marketplace revision submission.

## Recovery standard

The repaired products were tested against the exact officially packaged `.icuewidget`, not only source HTML.

Required recovery gates:

1. Generate canonical shipping widget with `tools/xeneon/inline.py`.
2. Deterministic generation check.
3. Official `icuewidget-cli@0.4.47 validate`.
4. Official `icuewidget-cli@0.4.47 package`.
5. ZIP integrity and root `index.html` / `manifest.json` extraction checks.
6. Lexical iCUE property binding regression against the exact package.
7. Product-specific settings regression where required.
8. Corsair Labs `iCUE-widget-runner-windows` Windows host smoke against the exact package.
9. StreamSpell remains a separate layout/package approximation and is not authoritative for real iCUE settings behavior.

The Corsair Labs runner is useful but not authoritative by itself because its compatibility shim injects settings as ordinary `window` properties. RatPack therefore keeps a stricter lexical-binding gate so a permissive runner shim cannot hide the same class of real iCUE failure seen by Marketplace reviewers.

## Final recovery evidence

Recovery workflow: `XENEON Marketplace Recovery 2026-08-27`

Final passing run: `33130590648`

Result: **7 / 7 products passed**.

All seven final evidence artifacts were generated from commit `dde5963fb9582ac56270110d63dd2d8da647ec94` before the recovery PR was merged to `main`.

Recovery PR: `#93 — Harden XENEON Marketplace recovery with Corsair Labs runner`

Merged to `main` on August 27, 2026.

## Product ledger

### Desk Notes Lite

Marketplace product ID: `3926a6a3-5860-4e11-a01b-7e90f8a4c900`

Reviewer feedback: changing settings in iCUE did not update the widget.

Recovery:

- hardened generated iCUE property binding bridge
- strict lexical binding smoke against the exact package
- dedicated Desk Notes content regression changes real board title and note text values and verifies visible rerender after `icueEvents.onDataUpdated`
- Corsair Labs Windows runner exact-package host smoke

Final state: `qa_passed`, ready for revision submission.

### Desk Notes Pro

Marketplace product ID: not captured in the original rejection notes. Recover from Maker Console before recording a revision-specific ID here.

Reviewer feedback: settings in the iCUE app did not appear to affect the widget.

Recovery:

- same hardened property binding bridge as Lite
- strict lexical binding smoke
- dedicated content settings regression
- Corsair Labs Windows runner exact-package host smoke

Final state: `qa_passed`, ready for revision submission.

### Weather Timeline Lite

Marketplace product ID: `418f836f-b5fb-4456-b412-9b7fe9295aa0`

Reviewer feedback: installation reported the file as unsupported or corrupted.

Recovery findings:

- corruption does not reproduce from the current canonical packaging path
- official validation passes
- official package creation passes
- package is ZIP-compatible and passes archive integrity checks
- `index.html` and `manifest.json` exist at package root
- exact package extracts successfully
- exact package loads in the Corsair Labs Windows runner
- a latent missing documented iCUE lifecycle callback was fixed proactively so settings now also use `icueEvents.onDataUpdated`

Final state: `qa_passed`, ready for revision submission using a newly generated package. Do not reuse the previously submitted artifact.

### Weather Timeline Pro

Marketplace product ID: `160c8019-ce77-49d8-a306-8ef1764a70c5`

Reviewer feedback: installation reported the file as unsupported or corrupted.

Recovery findings and fix are the same class as Lite. Current canonical packaging is healthy and the real iCUE update lifecycle is now present.

Final state: `qa_passed`, ready for revision submission using a newly generated package. Do not reuse the previously submitted artifact.

### Work Session Tracker Lite

Marketplace product ID: `e11e003d-5ca3-4c2d-ba94-f37fca8dabc7`

Reviewer feedback: Custom Style values did not adjust the widget in iCUE.

Root cause: the packaged runtime did not expose the real `icueEvents.onDataUpdated` lifecycle required for property changes to rerender the widget.

Recovery:

- added `icueEvents.onICUEInitialized`
- added `icueEvents.onDataUpdated`
- rerender on iCUE setting updates
- strict lexical Custom Style regression
- Corsair Labs Windows runner exact-package host smoke

Final state: `qa_passed`, ready for revision submission.

### Work Session Tracker Pro

Marketplace product ID: `f8e12d94-4354-41ca-b6da-beb2297fb9e2`

Reviewer feedback: Custom Style could not be made to work in the iCUE app.

Root cause and recovery are the same class as Lite.

Final state: `qa_passed`, ready for revision submission.

### PC Power Meter Lite

Marketplace product ID: `113488ed-3043-48b5-96d0-67c2130cc1ed`

Reviewer feedback:

1. Custom Style did not work in iCUE.
2. Reviewer did not have compatible power sensors and requested a short demo video proving functionality before approval.

Root cause for Custom Style: the shared runtime did not expose the real `icueEvents.onDataUpdated` lifecycle.

Recovery:

- added iCUE initialization and data update lifecycle callbacks
- setting changes reapply appearance values
- sensor-setting changes trigger a fresh sensor scan/reconciliation
- strict lexical Custom Style regression
- Corsair Labs Windows runner exact-package host smoke
- existing deterministic Sensors Data Provider fixture verifies sensor enumeration, total-power-draw scope, watts, rolling graph, session energy, average, peak, duplicate sensor names, disconnect, and reconnect behavior

Reviewer demo evidence workflow: `XENEON PC Power Review Evidence`

Successful `main` run: `33130887222`

Evidence type: exact official package driven by RatPack's deterministic simulated iCUE Sensors Data Provider fixture.

Recorded final state:

- current power: `405 W`
- session average: `419 W`
- session energy: `841 Wh`
- peak: `517 W`
- scope: `TOTAL POWER DRAW • MEASURED`
- selected sensor: `RMx SHIFT • Total Power Draw`
- graph series: `1`
- page errors: `0`

Important disclosure: this evidence proves product logic and provider lifecycle against a simulated iCUE Sensors provider. It is not evidence from a physical compatible PSU. If Marketplace requires hardware-origin telemetry specifically, a physical compatible system remains the only manual requirement.

Final state: `qa_passed`, ready for revision submission with reviewer evidence attached. Hardware-origin video remains conditional on reviewer acceptance requirements.

## System changes resulting from this recovery

The recovery was not treated as seven isolated product patches.

RatPack now has:

- a hardened static direct-binding iCUE compatibility bridge
- a strict lexical property binding regression
- a blocking Corsair Labs Windows host gate in normal XENEON Widget CI
- exact-package testing before StreamSpell
- explicit QA policy that Marketplace or real-host failures invalidate stale `qa_passed` evidence until the rejected behavior is covered by a passing regression
- product-specific Desk Notes settings regression
- reusable PC Power reviewer evidence workflow

The intended public QA order is now:

`canonical source → official validate → official package → exact-package integrity → lexical settings regression → Corsair Labs Windows runner → StreamSpell / product-specific QA → Marketplace`

A browser-only or StreamSpell-only pass is not sufficient evidence for iCUE property behavior.
