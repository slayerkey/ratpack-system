# RatPack local workspace

The local workspace is the execution environment; GitHub remains the canonical source of truth.

The repository can live anywhere on Windows. The current preferred checkout is:

`C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub`

After one time setup, the repository root is added to the user's PATH so `rat` can be called from any terminal.

## Normal commands

* `rat ship <slug> [slug...]` syncs canonical `main` once, then builds, validates, packages, captures, creates Rat Art, creates the ship kit, fills Maker Console, and submits locally on this PC. Existing dependencies are reused and missing runtime pieces are installed only when needed.
* `rat status` shows the current checkout state.
* `rat help` shows the command cheat sheet.

## Optional commands

* `rat ship-cloud <slug> [slug...]` preserves the old clean-runner path: explicitly run the full Rat Ship workflow on GitHub Actions, download the kit, then submit through the local Maker Console browser.
* `rat kit-cloud <slug> [slug...]` runs the clean GitHub Actions build and downloads the resulting kit without submitting.
* `rat kit <slug> [slug...]` builds fresh ship kits locally and opens the output without submitting.
* `rat stage <slug> [slug...]` builds locally and fills Maker Console without final submission.
* `rat submit <slug> [slug...]` is an alias for the normal local `rat ship` path.
* `rat update` fetches and fast forwards the current branch when the worktree is clean.
* `rat main` switches to `main` and fast forwards it.
* `rat open` opens the repository folder.
* `rat doctor` checks Git, Python, GitHub CLI, Node, repository state, and GitHub authentication.

The full GitHub Rat Ship, Rat Art, and deep XENEON CI workflows are opt in only. Normal pushes and pull requests use the lightweight RatPack CI instead, so routine development does not install Chromium, package widgets, or run the full shipping factory on hosted runners.

Generated local output belongs under `out/` and is ignored by Git. It should not go through Downloads.

The authenticated Maker Console browser profile remains under `%LOCALAPPDATA%\PackRat\maker-console-profile` and is never committed or uploaded to GitHub.

## One time Windows setup

If the repo is already cloned into `C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub`, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\setup-windows.ps1"
```

If it is not cloned yet, run:

```powershell
$dest='C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub'; if (!(Test-Path "$dest\.git")) { git clone https://github.com/slayerkey/ratpack-system.git "$dest" }; powershell -NoProfile -ExecutionPolicy Bypass -File "$dest\setup-windows.ps1"
```

The setup script installs GitHub CLI with winget if needed and opens its browser login if required. Normal local Rat Ship does not need a GitHub Actions runner; Git is still used to sync the canonical repository before a shipping queue starts.
