---
name: rat-qa
description: Run deterministic RatPack quality gates, route failures, and identify only the genuine final local checks.
---

# Rat QA

Run the product type appropriate automated checks before asking for local testing.

At minimum cover metadata, package structure, assets, copy rules, required variants, release notes or changelog expectations, and known platform constraints.

For plugins, include unit or fixture tests and vendor manifest validation.

For profiles, include ZIP structure, page structure, action IDs, required plugins, device variants, icons, and platform encoding.

For widgets, include inline build, structure, browser layout, behavior, deterministic capture, art checks, and vendor validation where the runner supports it.

For art, include dimensions, expected file count, font identity, required source presence, text bounds, device presence, widget shot presence, and nontrivial content occupancy.

Do not mark the whole workflow local because a final device check remains.

Report automated pass, warnings, blockers, and the smallest exact hardware or host test still required.
