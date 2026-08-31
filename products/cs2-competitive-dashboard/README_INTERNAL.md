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

Rat Dev keeps the canonical checkout on `main` and builds the product branch in:

```text
out\dev\worktrees\cs2-competitive-dashboard
```

Perform the Deathmatch, provider, diagnostics, long-label, and restart checks in `FINAL_HOST_TEST.md`. Then, while Stream Deck/plugin is still running, record the final physical evidence from the canonical RatPack root with:

```powershell
npm --prefix .\out\dev\worktrees\cs2-competitive-dashboard\products\cs2-competitive-dashboard\plugin run host:audit:release -- --hs-ok --labels-ok --restart-ok
```

Only use an attestation flag when that human-visible check genuinely passed.

A successful run writes the local gitignored worktree evidence:

```text
out\dev\worktrees\cs2-competitive-dashboard\products\cs2-competitive-dashboard\plugin\.release-evidence\host-pass.json
```

That evidence includes the exact runtime/build fingerprint, sustained GSI evidence, Open Log Folder evidence, live localhost diagnostics, one provider refresh with both Leetify and FACEIT ready, and the three explicit human checks.

## Exact Marketplace release flow

After the official Leetify dark-background SVG is installed at:

```text
products/cs2-competitive-dashboard/plugin/static/ui/leetify-provided-dark.svg
```

and `LEETIFY_COMMERCIAL_CLEARANCE.md` records `Status: CLEARED`:

1. commit those non-runtime release changes to `product/cs2-competitive-dashboard`;
2. run `rat dev cs2-competitive-dashboard` again so the detached worktree receives them while preserving ignored physical evidence;
3. optionally verify without mutation using:

```powershell
npm --prefix .\out\dev\worktrees\cs2-competitive-dashboard\products\cs2-competitive-dashboard\plugin run release:final
```

4. when ready to advance the actual branch, use:

```powershell
npm --prefix .\out\dev\worktrees\cs2-competitive-dashboard\products\cs2-competitive-dashboard\plugin run release:promote
```

`release:promote` reruns the complete final gate, fetches current `origin`, refuses if the tested worktree is stale or dirty, changes only the Pro registry to `READY_TO_SHIP`, creates one normal commit, and pushes it to `product/cs2-competitive-dashboard` without force. If the remote branch moved, it refuses before promotion.

After promotion succeeds, merge PR #29 to `main`, then:

```powershell
rat main
rat ship cs2-competitive-dashboard-pro
```

## Rat Ship state

The shared Rat Ship helper supports this product's deterministic multi-flavor build through Pro's explicit:

```text
ship_plugin_dir = out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin
```

Windows CI exercises the real helper end to end and verifies a non-public Pro kit containing the `.streamDeckPlugin`, `submission.json`, description/release-note paste files, search icon, cover, and four gallery images.

The plugin manifest and registry use the canonical PackRat Marketplace maker URL:

```text
https://marketplace.elgato.com/maker/packrat
```

Once the physical evidence and final Marketplace gate pass, stop adding features and ship Pro.
