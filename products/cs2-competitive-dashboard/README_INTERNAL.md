# CS2 Competitive Dashboard Internal State

The product has moved beyond the original profile-planning and GSI-feasibility stage.

## Current commercial decision

* **CS2 Live Stats** remains the existing simpler paid product at $6.99.
* **CS2 Competitive Dashboard Pro** is the premium competitive product at $14.99 one time.
* **CS2 Competitive Dashboard Lite** remains an internal shared-engine build and is not part of the initial Marketplace launch.
* Pro and Lite both fail closed in the canonical registry with `workflow_state: BLOCKED` until their explicit release boundaries change.

Pro already includes validated bundled **Competitive** and **Live Match** profiles for supported Stream Deck device types.

The real Windows Valve GSI transport gate has passed on physical hardware. Do not restart the original GSI feasibility investigation unless new host evidence shows a regression.

## Current sources of truth

1. `FINAL_HOST_TEST.md` — the one comprehensive Windows + CS2 + physical Stream Deck release pass.
2. `RELEASE.md` — positioning, price, listing truth, provider policy, attribution, and Marketplace gates.
3. `LEETIFY_COMMERCIAL_CLEARANCE.md` — copy-paste Leetify paid-use request, official badge source, and approval record.
4. `plugin/submission.json` — canonical Pro Marketplace metadata and listing copy used by Rat Ship.
5. `QA.md` and historical host-debug documents — implementation history and regression context only.

If an older document conflicts with `FINAL_HOST_TEST.md`, the final host test wins.

## Exact physical release flow

Develop/install Pro through the canonical Rat target:

```powershell
rat main
rat dev cs2-competitive-dashboard
```

Perform the Deathmatch, provider, diagnostics, long-label, and restart checks in `FINAL_HOST_TEST.md`. Then, while Stream Deck/plugin is still running, record the final physical evidence with:

```powershell
cd products\cs2-competitive-dashboard\plugin
npm run host:audit:release -- --hs-ok --labels-ok --restart-ok
```

Only use an attestation flag when that human-visible check genuinely passed.

A successful run writes the local gitignored:

```text
.release-evidence/host-pass.json
```

That evidence includes the exact runtime/build fingerprint, sustained GSI evidence, Open Log Folder evidence, live localhost diagnostics, one provider refresh with both Leetify and FACEIT ready, and the three explicit human checks.

## Exact Marketplace release flow

After the official Leetify dark-background SVG is installed at:

```text
plugin/static/ui/leetify-provided-dark.svg
```

and `LEETIFY_COMMERCIAL_CLEARANCE.md` records `Status: CLEARED`, run:

```powershell
npm run release:final
```

`release:final` refuses to pass if the physical evidence is missing, older than seven days, or belongs to different runtime/build inputs.

When the final gate passes, promote the canonical registry without hand-editing JSON:

```powershell
npm run release:promote
```

That changes Pro from `BLOCKED` to `READY_TO_SHIP`. Review/commit the registry promotion, merge the release candidate to `main`, then run Rat Ship from canonical main.

## Rat Ship state

The shared Rat Ship helper now supports this product's deterministic multi-flavor build through Pro's explicit:

```text
ship_plugin_dir = out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin
```

Windows CI exercises the real helper end to end and verifies a non-public Pro kit containing the `.streamDeckPlugin`, `submission.json`, description/release-note paste files, search icon, cover, and four gallery images.

Once the physical evidence and final Marketplace gate pass, stop adding features and ship Pro.
