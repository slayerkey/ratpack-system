# Rat build isolation invariant

## Rule

The canonical RatPack checkout is a control plane, not a build directory.

Normal product commands must not write generated product output into canonical `main`.

* `rat dev` builds in isolated development worktrees/candidates.
* `rat kit`, `rat stage`, `rat submit`, and `rat ship` build Stream Deck plugins and XENEON widgets in disposable detached Git worktrees.
* Final release artifacts are copied to `out/ship/<slug>`.
* Shared runtime caches such as Playwright/Chromium may be reused, but generated product files must stay outside canonical source.

## Why

Older local shipping paths built directly inside canonical source and attempted to clean afterward. A failed build, parser error, package generator, interrupted process, or art script could therefore leave tracked/untracked generated files behind. That dirty checkout could then:

1. block Rat's self-update bootstrap,
2. prevent the next product in a multi-product queue from syncing,
3. make an unrelated product look broken,
4. require manual `git restore` / `git clean` recovery.

Cleanup after mutation is not a sufficient reliability boundary. Isolation is.

## Shipping lifecycle

For each local shipping product:

1. Rat syncs and verifies canonical `main` once.
2. Rat asserts the canonical checkout is clean.
3. Rat creates a detached disposable worktree at the exact canonical `HEAD` under the system temp directory.
4. Build, dependency install, code generation, tests, official validation, package generation, capture, and Rat Art execute inside that worktree.
5. The finished ship kit is copied/written to `out/ship/<slug>` in the canonical checkout.
6. The disposable worktree is force removed even when the product fails.
7. Rat asserts canonical `main` is still clean.
8. The queue may continue to the next product without inheriting build residue.

XENEON isolated worktrees reuse the canonical shared `tools/node_modules` dependency cache through a temporary junction. The junction is removed before worktree deletion; the shared cache is never treated as product source.

## Failure invariant

A product build is allowed to fail. It is not allowed to dirty canonical `main`.

This includes failures in:

* npm install/build/test
* Stream Deck CLI validation/package
* CORSAIR CLI validation/package
* XENEON inline generation
* Playwright capture
* Rat Art
* metadata/kit generation
* Ctrl+C or exceptions handled by the shipping wrapper

A canonical checkout mutation after an isolated build is treated as an infrastructure failure and Rat fails closed with `Isolated build invariant violated` rather than silently continuing.

## CI gate

`Rat Ship Marketplace Routing CI` runs on Windows and verifies:

* the Marketplace PowerShell helpers parse,
* both Stream Deck and XENEON ship helpers route through `New-RatDisposableWorktree`,
* tracked and untracked mutations made inside a disposable worktree do not change canonical Git status,
* the disposable worktree is removed,
* canonical Git status is clean after cleanup,
* the release-state guard still behaves correctly.

## Legacy recovery

`rat-bootstrap.ps1` may contain narrowly scoped recovery for artifacts left by known pre-isolation Rat versions. Those rules are migration recovery only, not the normal build model.

Do not add broad automatic `git clean` or `git restore` behavior to compensate for a new build tool writing into main. Fix the build tool to use isolation instead.
