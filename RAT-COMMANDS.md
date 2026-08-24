# RatPack command cheat sheet

You only need to remember a few commands for normal use.

## `rat ship <slug>`

This is the main release command.

Example:

```text
rat ship helldivers
```

What it does:

1. Switches the local checkout to the latest `main`.
2. Triggers the Rat Ship GitHub Actions workflow.
3. Runs the canonical build, validation, official package, Rat Art, and ship kit pipeline in GitHub.
4. Waits for the workflow to finish.
5. Replaces the old local output for that product.
6. Downloads the fresh ship kit into:

```text
out\ship\<slug>
```

7. Reuses the local Rat Ship Playwright runtime instead of reinstalling it inside every ship kit.
8. Opens Maker Console with the persistent local PackRat browser profile.
9. Reuses the existing Maker Console login when the session is still valid.
10. Fills the product draft from the canonical ship kit.
11. Uploads the official widget package and Rat Art.
12. Sets marketplace metadata, release notes, price, and auto publish policy.
13. Submits the product.

If Maker Console or Chromium stops unexpectedly, Rat Ship restarts the browser and retries with the saved resume state up to three times.

Authentication is local only. Maker Console cookies and session state stay under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```

GitHub Actions never receives Maker Console cookies, passwords, browser profile data, or session tokens.

The first time the local Maker Console profile is used, Elgato may require you to sign in manually in the browser window. After that, the persistent profile should normally reuse the session until Elgato expires it.

## `rat dev <slug>`

This is the normal one-command local development updater for Stream Deck plugins that need a real local host application to test.

Examples:

```text
rat dev discord-bridge
rat dev valorant-tracker
```

What it does:

1. Fetches the latest canonical GitHub source without switching or dirtying the main RatPack checkout.
2. Prefers `origin/product/<slug>` for products developed inside RatPack. Products registered as external repositories automatically fetch their configured repository and development ref instead.
3. Reuses a development checkout under:

```text
out\dev\worktrees\<slug>
```

RatPack-native products use detached worktrees. Registered external products use a reusable local clone in the same location.

4. Installs plugin dependencies only when needed.
5. Runs the plugin build and automated tests declared by the product.
6. Runs the official Elgato Stream Deck CLI validator.
7. Removes the previously linked development copy of the same plugin.
8. Links the fresh plugin into Stream Deck developer mode and restarts it.
9. Opens the product's local status page when `rat-dev.json` declares one.

Normal iteration should not use Downloads, hand-copied ZIP folders, or manually installed development packages. Product-specific local state stays inside the normal Stream Deck application or the ignored RatPack `out` directory.

`rat dev` currently targets Stream Deck plugins. A product opts in with `plugins/<slug>/rat-dev.json`. That file can live with the product source inside RatPack, or act as a thin registration pointing Rat Dev at a separate canonical GitHub repository and ref.

The first run may install the official `@elgato/cli` once. Current Stream Deck CLI development requires Node.js 24 or newer.

## `rat status`

Shows:

* local repo path
* current branch
* latest commit
* whether local files have changed

Use this if you want to know whether your local RatPack checkout is clean and current.

## `rat help`

Prints the main command cheat sheet in the terminal.

## Optional commands

### `rat kit <slug>`

Runs the fresh Rat Ship GitHub pipeline and downloads the resulting marketplace ship kit, but does not open Maker Console or submit anything.

This is useful when you specifically want the files only.

### `rat stage <slug>`

Runs the same fresh Rat Ship process, launches Maker Console, fills the listing, uploads the package and media, and stops before the final Submit action.

Use this when you want to inspect the finished Maker Console draft manually.

### `rat submit <slug>`

Alias for `rat ship <slug>`.

### `rat update`

Fetches GitHub and fast forwards the current branch if the local worktree is clean.

### `rat main`

Switches to `main` and pulls the latest canonical RatPack.

### `rat open`

Opens the RatPack repo folder in Explorer.

### `rat doctor`

Checks Git, Node, npm, GitHub CLI, GitHub authentication, repo state, and whether the persistent Maker Console profile exists.

# Local layout

Current preferred Windows location:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub
```

Generated output stays inside:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\out
```

`out/` is ignored by Git, so generated marketplace kits and development worktrees do not clutter source control or the Downloads folder.

Development worktrees and external development clones live under:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\out\dev\worktrees
```

The shared local Rat Ship browser runtime lives in:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\tools\ship
```

The Maker Console browser profile stays outside the repo under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```
