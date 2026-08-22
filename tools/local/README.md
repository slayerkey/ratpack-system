# RatPack local workspace

The local workspace is a convenience bridge, not the source of truth.

Canonical source remains GitHub. The recommended Windows checkout is:

`C:\GitHub\ratpack-system`

After one-time setup, the repository root is added to the user's PATH so `rat` can be called from any terminal.

Supported commands:

* `rat status` shows the current checkout state.
* `rat update` fetches and fast-forwards the current branch when the worktree is clean.
* `rat main` switches to `main` and fast-forwards it.
* `rat ship <slug>` triggers Rat Ship on GitHub Actions and downloads the completed artifact directly into `out\ship\<slug>`.
* `rat stage <slug>` does the same and then opens the local authenticated Maker Console bridge without submitting.
* `rat submit <slug>` does the same and then runs the explicit final submission bridge.
* `rat open` opens the repository folder.
* `rat doctor` checks Git, GitHub CLI, Node, repository state, and GitHub authentication.

Generated local output belongs under `out/` and is ignored by Git.

The authenticated Maker Console browser profile remains under `%LOCALAPPDATA%\PackRat\maker-console-profile` and is never committed or uploaded to GitHub.
