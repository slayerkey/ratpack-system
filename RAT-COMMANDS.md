# RatPack command cheat sheet

You only need to remember a few commands for normal use.

## `rat ship <slug> [slug...]`

This is the main release command for both XENEON widgets and registered Stream Deck plugins.

Single product:

```text
rat ship helldivers
```

Multiple products in one queue:

```text
rat ship weather-timeline-pro weather-timeline snake desk-notes
```

Rat Ship runs local first. At the start of the queue it switches the local checkout to the latest canonical `main` once. It then processes every product sequentially on the Windows PC so one authenticated Maker Console browser profile is never driven by two submissions at the same time.

The Marketplace router reads `products/<slug>.json` and chooses the correct canonical release path. XENEON widgets stay on the proven CORSAIR pipeline. Stream Deck plugins use the official Elgato Stream Deck CLI and `.streamDeckPlugin` package path. Mixed queues are supported.

If one product fails, Rat Ship records that failure, continues the remaining queue, and prints a failure summary at the end.

Every product kit is written under:

```text
out\ship\<slug>
```

The normal path does not start a GitHub Actions runner. GitHub remains the source of truth because the queue syncs canonical `main` before it builds anything.

### Stream Deck plugin release path

For a registered Stream Deck plugin, Rat Ship:

1. Reads the canonical `products/<slug>.json` registry entry and product source path.
2. Installs locked dependencies with `npm ci` when a lockfile exists.
3. Runs the product build and tests.
4. Runs the official Elgato Stream Deck CLI validator.
5. Creates the official `.streamDeckPlugin` package.
6. Runs the product's deterministic `rat-art.ps1` when present.
7. Builds the local ship kit with description, release notes, package, search icon, cover, and gallery media.
8. Reuses the persistent local Maker Console browser runtime and login.
9. Creates or safely resumes the correct Plugin product type in Maker Console.
10. Sets the applicable plugin metadata, pricing, language, media, release notes, and auto publish policy.
11. Submits the product.

`rat kit <slug>` is allowed before Marketplace pricing is chosen because it does not create a Maker Console product. `rat stage <slug>` and `rat ship <slug>` fail closed when `submission.price_usd` is still unset, because Maker Console monetization can become irreversible after product creation.

### XENEON widget release path

For a XENEON widget, Rat Ship keeps the existing canonical flow:

1. Reuses the already synced canonical `main` checkout.
2. Checks the required local runtime and installs only missing pieces.
3. Regenerates the canonical shipping widget with `tools/xeneon/inline.py`.
4. Refuses to ship if the generated shipping widget has uncommitted drift.
5. Runs the official CORSAIR validator with the pinned iCUE Widget CLI.
6. Creates the official `.icuewidget` package.
7. Captures the real widget locally for Rat Art.
8. Renders deterministic Rat Art locally.
9. Renders the canonical marketplace search icon.
10. Builds and validates the Maker Console ship kit.
11. Reuses the persistent local Maker Console browser runtime and login.
12. Fills the product draft from the canonical ship kit.
13. Uploads the official package and Rat Art.
14. Sets marketplace metadata, release notes, price, and auto publish policy.
15. Uploads gallery media in the canonical order.
16. Submits the product.

### Local dependency behavior

Rat Ship expects Git, Python, Node, npm, and npx to exist on the Windows machine. It checks pinned runtime pieces such as Pillow and Playwright, and installs them only if missing. Chromium is checked by executable path and is only installed when the existing Playwright runtime cannot find it.

Stream Deck plugins use their locked local `@elgato/cli` dependency through `npx` for validation and packaging. XENEON widgets use the pinned CORSAIR iCUE Widget CLI.

### Gallery order

The XENEON marketplace sequence is intentionally:

1. Cover / hero
2. Feature and value breakdown
3. Main product showcase / highest value feature
4. Settings, interaction, or alternate state
5. Slot size compatibility

The cover is separate from the gallery. Rat Ship uploads the four gallery images as one ordered FileList when Maker Console exposes a multi file input. If Maker Console only exposes a single file uploader, Rat Ship uses the compatibility ordering needed to preserve the final visible gallery sequence.

Stream Deck plugin products can provide their own deterministic Rat Art sequence, but the local plugin ship kit expects the same canonical file names: `01_search_icon.png`, `02_cover.png`, and `03_gallery_01.png` through `06_gallery_04.png`.

### Crash and recovery behavior

Recoverable Maker Console or Chromium failures are retried with saved resume state up to three times for both supported product types.

Rat Ship does not blindly retry a draft whose irreversible state is wrong. For example, if a paid product is found in a Maker Console draft or listing whose monetization is already locked to Free, Rat Ship stops immediately and explains that the incorrect draft must be removed before recreating it.

On a local Maker Console failure Rat Ship creates:

```text
out\ship\<slug>\log.zip
```

The ZIP contains recovery screenshots, error text, state, and page diagnostics. Rat Ship also opens Explorer with the recovery ZIP selected so it is easy to drag into a support or debugging chat.

Authentication is local only. Maker Console cookies and session state stay under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```

GitHub Actions never receives Maker Console cookies, passwords, browser profile data, or session tokens.

## Clean GitHub runner commands

The old hosted XENEON build path is still available when a fresh external environment is useful.

### `rat ship-cloud <slug> [slug...]`

Explicitly runs the XENEON Rat Ship GitHub Actions workflow, downloads the resulting ship kit, and then uses the local authenticated Maker Console bridge to submit it.

Use this when you specifically want a clean GitHub hosted XENEON build rather than the normal local build.

### `rat kit-cloud <slug> [slug...]`

Runs the same clean XENEON GitHub Actions build and downloads the resulting marketplace ship kit, but does not open Maker Console or submit anything.

The full Rat Ship, Rat Art, and deep XENEON workflows are manual dispatch workflows only. They do not run automatically on ordinary pull requests.

## Automatic CI

Normal pushes and pull requests use `RatPack Lightweight CI` plus any product or shared tooling gate whose path matches the changes. Lightweight CI validates canonical context, parses JSON, and checks the syntax of local helpers without running a full Marketplace submission.

Expensive rendering, packaging, host smoke tests, and Maker Console work happen in product release gates, locally during normal shipping, or through an explicit cloud workflow when requested.

## `rat dev <slug>`

This is the normal one command local development updater for products that need a real Windows host application or XENEON Edge to test.

Examples:

```text
rat dev discord-bridge
rat dev discord-panel
rat dev valorant-tracker
```

Rat Dev first fetches the latest canonical GitHub source without switching or dirtying the main RatPack checkout. It prefers `origin/product/<slug>` during active development and reuses an ignored development checkout under:

```text
out\dev\worktrees\<slug>
```

### Stream Deck plugins

For a Stream Deck plugin Rat Dev:

1. Reads the registered plugin UUID before creating the development checkout.
2. Stops and unlinks any previous development or manually installed copy, with retries while Windows releases plugin files.
3. Installs dependencies only when needed.
4. Runs the product build and automated tests.
5. Runs the official Elgato Stream Deck CLI validator.
6. Links the fresh plugin into Stream Deck developer mode and restarts it.
7. Opens the product's local status page when `rat-dev.json` declares one.

A Stream Deck plugin opts in with `plugins/<slug>/rat-dev.json`. The registration should include `plugin_uuid` so Rat Dev can clean up an older installed copy before the first development worktree exists. The file can live with the product source inside RatPack, or act as a thin registration pointing Rat Dev at a separate canonical GitHub repository and ref.

### XENEON Edge widgets

For a XENEON widget Rat Dev automatically detects `widgets/_src/<slug>` and:

1. Reuses the same ignored detached development worktree.
2. Runs the widget's local `verify.mjs` regression suite when one is present.
3. Regenerates the canonical flattened shipping widget with `tools/xeneon/inline.py`.
4. Runs the official CORSAIR widget validator.
5. Packages the widget with the official CORSAIR CLI.
6. Copies the fresh package to:

```text
out\dev\packages\<slug>\<slug>.icuewidget
```

7. Opens the `.icuewidget` package so iCUE can import it for the physical XENEON Edge smoke test.

The final iCUE import confirmation is intentionally left to the user because it is a host UI action. Everything before that is regenerated from canonical GitHub source by the command.

If Rat Dev fails, it automatically opens the product's local development folder so logs or generated files are immediately available for inspection.

Normal iteration should not use Downloads, hand copied ZIP folders, or manually installed development source folders. Product specific local state stays inside the host application or the ignored RatPack `out` directory.

The first Stream Deck run may install the official `@elgato/cli` once. Current Stream Deck development requires Node.js 24 or newer. XENEON development uses the pinned official `icuewidget-cli@0.4.47` through `npx`.

## `rat status`

Shows the local repo path, current branch, latest commit, and whether local files changed.

## `rat help`

Prints the main command cheat sheet in the terminal.

## Optional commands

### `rat dev-open <slug>`

Opens the reusable local development folder for a product without rebuilding or reinstalling it.

### `rat kit <slug> [slug...]`

Runs the full canonical shipping pipeline locally and opens the resulting ship kit, but does not open Maker Console or submit anything. For Stream Deck plugins this can be used before pricing is finalized.

### `rat stage <slug> [slug...]`

Runs the same local shipping process, launches Maker Console, fills the listing, uploads the package and media, and stops before final Submit. Stream Deck plugin staging requires an explicit `submission.price_usd` before Maker Console is opened.

### `rat submit <slug> [slug...]`

Alias for `rat ship` and therefore uses the normal local first, product-type-aware path.

### `rat update`

Fetches GitHub and fast forwards the current branch if the local worktree is clean.

### `rat main`

Switches to `main` and pulls the latest canonical RatPack.

### `rat open`

Opens the RatPack repo folder in Explorer.

### `rat doctor`

Checks Git, Python, Node, npm, GitHub CLI, GitHub authentication, repo state, and whether the persistent Maker Console profile exists.

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

Development XENEON packages live under:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\out\dev\packages
```

The shared local Rat Ship browser runtime lives in:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\tools\ship
```

The Maker Console browser profile stays outside the repo under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```
