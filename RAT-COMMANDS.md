# RatPack command cheat sheet

You only need to remember three commands for normal use.

## `rat ship <slug>`

This is the main command.

Example:

```text
rat ship now-playing
```

What it does:

1. Switches the local checkout to the latest `main`.
2. Triggers the Rat Ship GitHub Actions workflow.
3. Runs the canonical build, validation, package, Rat Art, and ship kit pipeline in GitHub.
4. Waits for the workflow to finish.
5. Replaces the old local output for that product.
6. Downloads the fresh ship kit into:

```text
out\ship\<slug>
```

7. Opens that folder in Explorer.

For normal marketplace work, manually upload the files from that folder. The Playwright Maker Console bridge is optional and is not required by `rat ship`.

## `rat status`

Shows:

* local repo path
* current branch
* latest commit
* whether local files have changed

Use this if you want to know whether your local RatPack checkout is clean and current.

## `rat help`

Prints the command cheat sheet in the terminal.

## Optional commands

### `rat update`

Fetches GitHub and fast forwards the current branch if the local worktree is clean.

### `rat main`

Switches to `main` and pulls the latest canonical RatPack.

### `rat stage <slug>`

Runs the same fresh Rat Ship process and then launches the optional local Maker Console Playwright bridge without final submission.

### `rat submit <slug>`

Runs the same fresh Rat Ship process and then launches the optional authenticated Maker Console Playwright submission bridge.

Use this only if you want browser automation. Manual upload through `rat ship` is fully supported.

### `rat open`

Opens the RatPack repo folder in Explorer.

### `rat doctor`

Checks Git, Node, npm, GitHub CLI, GitHub authentication, and local repo state.

# Local layout

Current preferred Windows location:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub
```

Generated output stays inside:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\out
```

`out/` is ignored by Git, so generated marketplace kits do not clutter source control or the Downloads folder.

The Maker Console browser profile, if you ever use the optional Playwright bridge, stays outside the repo under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```
