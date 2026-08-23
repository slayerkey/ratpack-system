# RatPack local workspace

The local workspace is a convenience bridge, not the source of truth. GitHub remains canonical.

The repository can live anywhere on Windows. The current preferred checkout is:

`C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub`

After one time setup, the repository root is added to the user's PATH so `rat` can be called from any terminal.

## Normal commands

* `rat ship <slug>` syncs `main`, runs Rat Ship in GitHub Actions, downloads the fresh ship kit into `out\ship\<slug>`, and opens that folder in Explorer. This is the normal manual marketplace workflow. It does not require the Maker Console Playwright bridge.
* `rat status` shows the current checkout state.
* `rat help` shows the command cheat sheet.

## Optional commands

* `rat update` fetches and fast forwards the current branch when the worktree is clean.
* `rat main` switches to `main` and fast forwards it.
* `rat stage <slug>` gets a fresh ship kit and opens the local authenticated Maker Console bridge without final submission.
* `rat submit <slug>` gets a fresh ship kit and runs the explicit authenticated Maker Console submission bridge.
* `rat open` opens the repository folder.
* `rat doctor` checks Git, GitHub CLI, Node, repository state, and GitHub authentication.

Generated local output belongs under `out/` and is ignored by Git. It should not go through Downloads.

The authenticated Maker Console browser profile remains under `%LOCALAPPDATA%\PackRat\maker-console-profile` and is never committed or uploaded to GitHub. The Playwright bridge is optional. Manual Maker Console upload from the `rat ship` output is fully supported.

## One time Windows setup

If the repo is already cloned into `C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub`, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\setup-windows.ps1"
```

If it is not cloned yet, run:

```powershell
$dest='C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub'; if (!(Test-Path "$dest\.git")) { git clone https://github.com/slayerkey/ratpack-system.git "$dest" }; powershell -NoProfile -ExecutionPolicy Bypass -File "$dest\setup-windows.ps1"
```

The private repo may open Git Credential Manager for one GitHub sign in. The setup script installs GitHub CLI with winget if needed and opens its browser login if required.
