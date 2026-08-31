# CS2 Competitive Dashboard Pro Final Host Test

This is the final physical Windows release candidate test. The goal is one complete pass that produces machine-readable release evidence tied to the exact runtime being tested. Do not reopen basic GSI setup investigation unless this pass produces new evidence that the transport itself regressed.

## Before launching CS2

1. Open the canonical RatPack checkout.
2. Run:

```powershell
rat main
rat dev cs2-competitive-dashboard
```

3. Use the Pro build installed by Rat Dev.
4. Import/open the bundled **CS2 Live Match** profile if Stream Deck developer linking did not run the normal bundled profile install lifecycle.
5. Open the Property Inspector for any CS2 Competitive Dashboard Pro action.
6. In Advanced Diagnostics confirm:

   * Plugin process: running
   * Stream Deck: connected
   * CS2 install: detected
   * CFG folder: writable
   * GSI config: installed
   * Local listener: running on `127.0.0.1`
   * CS2 process: not running yet if CS2 is still closed
   * Last GSI packet: none is expected before CS2 sends data

The expected persistent Pro log is:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

## Real Deathmatch pass

1. Launch CS2.
2. Enter Deathmatch.
3. Keep the full Live Match profile visible for several minutes. The final release audit requires at least the 300-packet logged checkpoint, but play longer than that so this is a meaningful sustained test rather than a timing exercise.
4. Confirm the physical keys continue updating smoothly without freezing or obviously falling behind.
5. Verify real values against the game for as many of these as are visible:

   * Score
   * Round
   * Kills
   * Deaths
   * K/D
   * Health
   * Armor
   * Money
   * Weapon
   * Ammo
   * Map
   * CS2 Status
   * Session ADR
   * Session HS%

6. Deliberately test the Deathmatch respawn fix:

   * get at least one headshot kill
   * die and respawn
   * get more kills, including another headshot if practical
   * repeat across several lives
   * compare Session HS% on Stream Deck with what actually happened in the session

The important regression is that HS% must continue accumulating across Deathmatch life-counter resets. It must not fall back to the previous behavior where only a maximum per-life/per-round headshot counter was retained.

7. Watch for a longer display value. Good examples include `DESERT EAGLE`, `M4A1 SILENCER`, `OVERPASS`, or another long weapon/map string. Confirm the value remains legible and does not visibly run off the key.

## Diagnostics controls

While the current Pro process is still running:

1. Press **Open Log Folder**.
2. Confirm Windows Explorer actually opens the PackRat CS2 log directory.
3. **Copy Diagnostic Summary** is optional. The automated audit discovers the live Pro localhost diagnostic service and prints its redacted summary automatically while the plugin remains running.

## Provider smoke test

Both provider integrations are part of the intended Pro launch, so the final release evidence requires one real successful refresh from each provider in the same latest plugin process.

### Leetify

1. Enter the Steam profile URL, SteamID64, or vanity identity for a public/visible test account that has Leetify data.
2. Enter a real customer-owned Leetify developer key.
3. Save keys and test the connection.
4. Confirm real provider-backed values load where available:

   * Premier CS Rating
   * current map Competitive rank
   * best Competitive map rank
   * recent result
   * win rate
   * Leetify Rating

5. Confirm **View on Leetify** opens the expected profile/source.
6. A private Leetify profile should show a clear private state rather than looking ready-but-empty.
7. The final paid build must show Leetify's official unmodified **Data Provided by Leetify** badge linked to `https://leetify.com/`. Plain text is only a development placeholder and is not the final release state.

### FACEIT

1. Enter a real customer-owned FACEIT App/API key for a Steam account with a matching FACEIT CS2 profile.
2. Save keys and test the connection.
3. Confirm real values load where available:

   * Elo
   * Level
   * Region
   * K/D
   * HS%
   * Win rate
   * recent record
   * recent match

4. Confirm **View on FACEIT** opens the expected profile when available.

A provider with no matching public profile/data should show a clear not-found/private/setup state rather than fake values, but the final release evidence itself needs one `ready` refresh from each shipping provider.

## Restart and recovery pass

1. Close CS2 completely.
2. Confirm the dashboard eventually stops claiming a live packet connection.
3. Relaunch CS2.
4. Re-enter a normal game mode.
5. Confirm live values reconnect without re-running setup or rewriting anything manually.
6. Restart Stream Deck once and confirm the plugin returns to a working local listener/config state.
7. After the restart, keep Stream Deck/plugin running for the final evidence command. If your provider settings are still configured, allow the provider refresh to complete again so the latest process contains current provider-ready evidence.

## One-command final physical release audit

When all three human observations below are true:

* Session HS% stayed accurate across Deathmatch respawns
* long key values remained readable
* CS2 + Stream Deck restart/recovery worked

leave Stream Deck/plugin running and execute:

```powershell
cd products\cs2-competitive-dashboard\plugin
npm run host:audit:release -- --hs-ok --labels-ok --restart-ok
```

This command first runs the normal core host audit, then requires and records:

* Stream Deck connection success
* CS2 installation detection
* writable cfg evidence
* listener bind success
* GSI setup ready
* real App ID 730 GSI payload
* payload normalization success
* runtime connected
* no `unhandled rejection` signature
* no `The request timed out` signature
* no core GSI startup/listener/config/normalization failure signature
* sustained live traffic reaching at least the 300-packet logged checkpoint
* **Open Log Folder** successfully exercised in the latest plugin process
* live redacted localhost diagnostics reachable
* a real Leetify provider refresh reaching `ready`
* a real FACEIT provider refresh reaching `ready`
* your explicit HS%, long-label, and restart/recovery attestations

If all of that passes, it writes this local gitignored evidence file:

```text
products\cs2-competitive-dashboard\plugin\.release-evidence\host-pass.json
```

The evidence includes a SHA-256 fingerprint of the runtime, Property Inspector, build inputs, profiles, and locked dependencies you actually tested. `npm run release:final` requires that exact fingerprint, so meaningful runtime changes after the physical test automatically force a new host pass. The official Leetify badge asset and Marketplace art/copy are intentionally outside that runtime fingerprint, so adding the approved attribution asset later does not by itself force another CS2 match.

You can still run the lighter diagnostic-only command at any time:

```powershell
npm run host:audit
```

but **`host:audit:release` is the final physical release gate**.

## Pass criteria

The physical host gate is complete only when:

1. `npm run host:audit:release -- --hs-ok --labels-ok --restart-ok` reports `CS2 RELEASE EVIDENCE: PASS`.
2. `.release-evidence/host-pass.json` exists.
3. You did not knowingly use the three attestation flags for a check that actually failed.

There is no separate manual checklist to remember after that command; the evidence file is the source of truth for `release:final`.

## If anything fails

Do not start a sequence of small blind troubleshooting experiments.

Collect this one evidence bundle:

1. Full output of:

```powershell
npm run host:audit:release -- --hs-ok --labels-ok --restart-ok
```

Use only the flags for observations that genuinely passed. If one human check failed, omit that flag; the command will tell us exactly which gate is missing.

2. The current Pro log:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

3. One sentence describing the visible mismatch, for example `Session HS% showed 42% after 5 headshot kills out of 6 total kills` or `DESERT EAGLE is clipped on the right edge`.

If the plugin was still running when the audit ran, its output already contains the redacted localhost Diagnostic Summary. Only use the Property Inspector's **Copy Diagnostic Summary** as a fallback if the audit says the live diagnostic endpoint was unreachable.

That bundle should be treated as the source of truth for the next debugging pass.

## Marketplace release after host PASS

The software/hardware evidence alone does not override provider licensing requirements. After the physical evidence passes and the official Leetify asset/paid-use clearance are available, run:

```powershell
npm run release:final
```

The final Marketplace gate requires all of these together:

* Pro registry price is $14.99
* Lite Marketplace launch remains held
* fresh physical host evidence is present and no more than 7 days old
* host evidence runtime fingerprint matches the exact release candidate
* real Leetify + FACEIT provider-ready evidence is included in that host pass
* the official unmodified Leetify attribution SVG is present and wired into the built Property Inspector
* Leetify paid/commercial product use has written clearance recorded in `LEETIFY_COMMERCIAL_CLEARANCE.md`

`rat ship` / `rat submit` also fail closed while the canonical Pro product workflow state is `BLOCKED`. Only move Pro to `READY_TO_SHIP` after `release:final` passes.

Once the physical evidence and final Marketplace gate pass, stop adding features and submit CS2 Competitive Dashboard Pro.
