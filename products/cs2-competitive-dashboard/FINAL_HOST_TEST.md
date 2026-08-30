# CS2 Competitive Dashboard Pro Final Host Test

This is the final physical Windows release candidate test. The goal is one complete pass with one evidence bundle if anything fails. Do not reopen basic GSI setup investigation unless this test produces new evidence that the transport itself regressed.

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
3. Keep the full Live Match profile visible for several minutes.
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
3. **Copy Diagnostic Summary** is now optional. `npm run host:audit` automatically discovers the live Pro localhost diagnostic service and includes its redacted summary whenever Stream Deck/plugin is still running.

## Provider smoke test

Do this during the same pass if real customer-owned provider keys are available.

### Leetify

1. Enter the Steam profile URL, SteamID64, or vanity identity for the test account.
2. Enter a real Leetify developer key.
3. Save keys and test the connection.
4. Confirm real provider-backed values load where available:

   * Premier CS Rating
   * current map Competitive rank
   * best Competitive map rank
   * recent result
   * win rate
   * Leetify Rating

5. Confirm **View on Leetify** opens the expected profile/source.
6. The final paid build must show Leetify's official unmodified **Data Provided by Leetify** badge linked to `https://leetify.com/`. Plain text is only a development placeholder and is not the final release state.

### FACEIT

1. Enter a real customer-owned FACEIT App/API key.
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

A provider with no matching public profile/data should show a clear not-found/private/setup state rather than fake values.

## Restart and recovery pass

1. Close CS2 completely.
2. Confirm the dashboard eventually stops claiming a live packet connection.
3. Relaunch CS2.
4. Re-enter a normal game mode.
5. Confirm live values reconnect without re-running setup or rewriting anything manually.
6. Restart Stream Deck once if practical and confirm the plugin returns to a working local listener/config state.

## Automated log and diagnostics audit

After the real match and diagnostics test, leave Stream Deck running and from the plugin directory run:

```powershell
cd products\cs2-competitive-dashboard\plugin
npm run host:audit
```

A passing audit checks the latest plugin process segment for:

* Stream Deck connection success
* CS2 installation detection
* writable cfg evidence
* listener bind success
* GSI setup ready
* first real GSI payload
* payload normalization success
* runtime connected
* no `unhandled rejection` signature
* no `The request timed out` signature
* no core GSI startup/listener/config/normalization failure signature

It also:

* reports whether Open Log Folder was exercised successfully in that process
* discovers the active Pro diagnostics endpoint in the isolated Pro port range
* prints the current redacted localhost Diagnostic Summary automatically

## Pass criteria

The physical host release gate passes only when all of the following are true:

1. Full Live Match profile remains responsive for several minutes.
2. `npm run host:audit` reports `CS2 HOST AUDIT: PASS`.
3. Session HS% behaves correctly across multiple Deathmatch deaths/respawns.
4. Open Log Folder opens Explorer.
5. Long key labels are physically readable.
6. CS2 and Stream Deck restart/recovery works without manual GSI setup.
7. Real Leetify and FACEIT provider keys have been smoke tested if those features are included in the shipping build.

## If anything fails

Do not start a sequence of small blind troubleshooting experiments.

Collect this one evidence bundle:

1. Full output of:

```powershell
npm run host:audit
```

2. The current Pro log:

```text
%APPDATA%\PackRat\CS2CompetitiveDashboard\logs\cs2-competitive-dashboard-pro.log
```

3. One sentence describing the visible mismatch, for example `Session HS% showed 42% after 5 headshot kills out of 6 total kills` or `DESERT EAGLE is clipped on the right edge`.

If the plugin was still running when `host:audit` ran, its output already contains the redacted localhost Diagnostic Summary. Only use the Property Inspector's **Copy Diagnostic Summary** as a fallback if the audit says the live diagnostic endpoint was unreachable.

That bundle should be treated as the source of truth for the next debugging pass.

## Marketplace release after host PASS

After the physical host test passes, run:

```powershell
npm run release:final
```

The final Marketplace gate intentionally remains blocked until:

* Pro registry price is $14.99
* Lite Marketplace launch remains held
* the official unmodified Leetify attribution SVG is present and wired into the built Property Inspector
* Leetify paid/commercial product use has written clearance recorded in `LEETIFY_COMMERCIAL_CLEARANCE.md`

Once both the physical host test and final Marketplace gate pass, stop adding features and submit CS2 Competitive Dashboard Pro.
