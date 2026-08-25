# Auto Queue for Claude Code Release QA

## Automated release gate

- `npm ci` from committed lockfile.
- Build TypeScript plugin and deterministic bundled profiles.
- Run unit and fixture suite.
- Official Elgato `streamdeck validate`.
- Official Elgato `streamdeck pack` release candidate.
- Windows build regression from a RatPack-style path containing spaces.
- RatPack lightweight context and PowerShell validation.

## Proven physical host behavior

- Windows VS Code Claude Code 2.1.243 detected through the extension-bundled CLI.
- PackRat HTTP hooks connected with per-install authentication.
- `UserPromptSubmit` identified the exact active interactive session.
- Auto targeting followed the active Claude chat.
- A PackRat-owned queued request was consumed at a supported `Stop` boundary.
- Claude continued in the same VS Code conversation and returned `AUTO QUEUE WORKED`.
- Queue moved 1 to 0 and continuation count moved to 1/6, then the session finished.

## Required final physical smoke before submission

1. Permission request: create a harmless Claude tool permission prompt and verify the Status key changes to NEED YOU without approving automatically.
2. Restart persistence: queue one harmless request, restart the Stream Deck plugin, and verify the request is still queued for the same chat.
3. Explicit two-chat routing: keep two Claude chats open, bind one Queue Prompt action to a specific chat, and verify the other chat cannot consume that queue.
4. Disconnect cleanup: click Disconnect and verify only PackRat-owned hook entries are removed from Claude settings.
5. Bundled profile import: install the packaged `.streamDeckPlugin` and confirm the appropriate ready-made profile is offered and its actions render correctly on a physical Stream Deck.
6. Ready-made prompt smoke: Run Tests or Continue queues once, shows confirmation, and executes only after the current Claude turn completes.

## Marketplace QA

- Public name: Auto Queue for Claude Code.
- Windows only for v1. Do not claim macOS until a real authenticated macOS host smoke passes.
- Claude Code minimum version 2.1.163.
- Description accurately says PackRat owns the queue and does not claim control of Claude's private native queued-message UI.
- No credentials, tokens, prompts, or local diagnostic state are included in the packaged plugin.
- Normal UI uses human chat labels; exact session IDs appear only under Advanced diagnostics.
- Thumbnail is 1920x960 PNG.
- At least three gallery images are 1920x960 PNG.
- App icon is 256x256 PNG with 512x512 high-DPI variant.
- Release notes match the packaged version.
- Price is explicitly approved before Maker Console draft creation because Marketplace monetization is not casually reversible.
