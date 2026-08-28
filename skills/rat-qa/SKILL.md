---
name: rat-qa
description: Run deterministic RatPack quality gates, route failures, and identify only the genuine final local checks.
---

# Rat QA

Run the product type appropriate automated checks before asking for local testing.

At minimum cover metadata, package structure, assets, copy rules, required variants, release notes or changelog expectations, and known platform constraints.

For plugins, include unit or fixture tests and vendor manifest validation.

For profiles, include ZIP structure, page structure, action IDs, required plugins, device variants, icons, and platform encoding.

For XENEON/iCUE widgets, include inline build, structure, browser layout, behavior, deterministic capture, art checks, official CORSAIR validation and packaging, exact package integrity/extraction, lexical iCUE property binding regression when controls are declared, Corsair Labs Windows runner smoke, and StreamSpell packaged verification where applicable.

Do not accept a compatibility runner alone as proof that iCUE settings work. The Corsair Labs runner currently writes settings onto the widget window, while real iCUE can expose document-level bindings with different semantics. A public widget with XENEON Custom Style controls must pass the RatPack lexical-binding smoke in addition to the runner smoke.

For art, include dimensions, expected file count, font identity, required source presence, text bounds, device presence, widget shot presence, and nontrivial content occupancy.

Do not mark the whole workflow local because a final device check remains.

Do not preserve a stale `qa_passed` state after Marketplace or real-host evidence demonstrates a failure. Route the product back to blocked/recovery status until the rejected behavior is covered by an automated regression and that regression passes against the exact package intended for resubmission.

Report automated pass, warnings, blockers, and the smallest exact hardware or host test still required.
