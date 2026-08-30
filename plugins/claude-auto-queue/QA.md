# Auto Queue for Claude Code Release QA

Current state: **RELEASE CANDIDATE**

Core architecture: **GO**

Final Windows host smoke: **PASS — 2026-08-25**

## Automated release gate

- `npm ci` from committed lockfile: PASS.
- TypeScript `tsc --noEmit`: PASS.
- Build plugin and five deterministic bundled profiles: PASS.
- 31 unit and fixture tests: PASS.
- Official Elgato `streamdeck validate`: PASS.
- Official Elgato `.streamDeckPlugin` packaging: PASS.
- Packaged plugin icon dimensions 256x256 and 512x512: PASS.
- Deterministic Marketplace search icon, cover, and four gallery frames: PASS.
- Marketplace media dimension gate: PASS.
- Rat Art visual review: PASS. See `ART_REVIEW.md`.
- Windows build regression from a RatPack-style path containing spaces: PASS.
- RatPack lightweight context and PowerShell validation: PASS.
- Shared canonical Rat Ship Stream Deck plugin routing: PASS and merged to `main`.
- Canonical plugin ship-kit builder integration: PASS.

## Proven real Windows host behavior

- Windows VS Code Claude Code 2.1.243 detected through the extension-bundled CLI.
- PackRat HTTP hooks connected with per-install authentication.
- `UserPromptSubmit` identified the exact active interactive session.
- Auto targeting followed the active Claude chat.
- A PackRat-owned queued request was consumed at a supported `Stop` boundary.
- Claude continued in the same VS Code conversation and returned the expected queued work result.
- Queue moved 1 to 0 and continuation count moved to 1/6, then the session finished.
- Final physical smoke reported PASS with no release-blocking issues.
- Permission attention behavior, restart persistence, explicit two-chat routing, Disconnect cleanup/reconnect, and physical profile/action behavior were smoke tested on the real host.
- Repeated queued round trips returned the exact queued test text.

## Required user-facing mental model

The release UI and listing must explain that Auto Queue is not an immediate send action:

1. Connect Claude Code once.
2. Send one normal message in the Claude chat to let PackRat learn that active chat.
3. Queue a follow-up while Claude is working. The queued prompt stays local and does not interrupt or type into VS Code.
4. When Claude finishes the current turn, the queued prompt becomes the next request in the same chat.

If Auto is waiting for a chat, the correct instruction is to send one normal Claude message first.

## Marketplace QA

- Public name: Auto Queue for Claude Code.
- Windows only for v1. Do not claim macOS until a real authenticated macOS host smoke passes.
- Claude Code minimum version 2.1.163.
- Description accurately says PackRat owns the queue and does not claim control of Claude's private native queued-message UI.
- No credentials, tokens, prompts, or local diagnostic state are included in the packaged plugin.
- Normal UI uses human chat labels; exact session IDs appear only under Advanced diagnostics.
- Cover is 1920x960 PNG.
- Four gallery images are 1920x960 PNG.
- Marketplace search icon is 512x512 PNG.
- Packaged plugin icon is 256x256 PNG with 512x512 high-DPI variant.
- Release notes match packaged version 0.1.0.0.
- Ready-made profiles are bundled for Standard, Mini, XL, Plus, and Neo.
- Price is explicitly approved before Maker Console draft creation because Marketplace monetization is not casually reversible.

## Final release boundary

Host QA is complete. Remaining steps are:

1. Set the explicitly approved `submission.price_usd` and matching product registry price.
2. Merge PR #70 to `main` after final CI.
3. Run `rat stage claude-auto-queue` for a final Maker Console review.
4. If the staged listing is correct, submit it or run `rat ship claude-auto-queue` from canonical main.
