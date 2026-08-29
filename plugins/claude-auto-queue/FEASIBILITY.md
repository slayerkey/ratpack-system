# Claude Auto Queue Feasibility Spike

## Current gate

**Automated feasibility: PASS.** The hardened spike passes Windows build, **21/21 deterministic regression tests**, locked dependency installation with `npm ci`, the official Elgato Stream Deck validator, and the RatPack context checks.

**Interactive host feasibility: REQUIRED.** Do not merge or start final Marketplace polish until the signed-in Windows Claude Code same-session handoff is proven on a real user session.

## Product promise under test

Queue follow-up work for Claude Code from Stream Deck without interrupting the current turn, then hand each PackRat-owned queued prompt to the same Claude Code session when that turn naturally reaches a supported Stop hook boundary.

This spike deliberately does **not** claim access to Claude Code's private interactive queued-message UI.

## Supported Claude surfaces used

The spike is intentionally limited to documented Claude Code integration surfaces:

- HTTP hooks written into the user's normal `~/.claude/settings.json` hook configuration.
- `UserPromptSubmit` to identify a fresh manual turn, establish the authoritative `session_id`, and reset the automatic continuation budget.
- `Stop` with `hookSpecificOutput.additionalContext` to continue the same conversation with the next PackRat queued prompt.
- `PermissionRequest`, `Notification`, `PermissionDenied`, `PostToolUse`, and `PostToolUseFailure` for attention-state transitions.
- `StopFailure` for explicit API, authentication, rate-limit, overload, billing, and related failure states.
- `TaskCreated` and `TaskCompleted` only as optional display enrichment.
- `claude agents --json` only as best-effort, read-only reconciliation for discoverability and display enrichment. Hook `session_id` remains authoritative because normal foreground interactive sessions are not guaranteed to appear in agent view.

Claude Code **2.1.163 or newer** is required. The local setup page refuses to connect the PackRat hooks on older or unparseable versions because the product depends on supported Stop-hook `additionalContext` continuation. Every additional lifecycle event used by the spike predates that version floor.

On Windows, PackRat checks Anthropic's native `%USERPROFILE%\.local\bin` install location, common npm and WinGet locations, and finally the Stream Deck process `PATH`. This avoids requiring an arbitrary Stream Deck restart merely because Claude's installer updated PATH after Stream Deck launched.

No Claude credentials are read, copied, uploaded, or modified. No hosted service is used. No terminal keystroke injection is used.

## Deliberate safety and integrity limits

Claude Code has its own eight-consecutive Stop-hook continuation guard. PackRat caps one automatic chain at **6 queued follow-ups** after a fresh manual user turn, leaving margin below Claude's guard.

When the cap is reached, later work remains queued and the session becomes `NEED YOU` rather than pretending the remaining items ran.

The queue does not advance while a Stop event reports background tasks or session cron work that can wake the session again.

If multiple Claude sessions are visible and no exact active session has been learned from hooks or explicitly selected, the plugin refuses to guess. The Property Inspector and local setup page both support explicit session binding.

PackRat hook requests carry a random per-install token in the configured HTTP-hook header. The localhost hook endpoint uses constant-time token comparison and does not expose the token in diagnostics.

The local setup API binds only to `127.0.0.1`, requires its canonical Host header, and rejects cross-site or non-JSON mutation requests. The diagnostics page also sets restrictive browser security headers.

PackRat keeps a first-change recovery backup of Claude settings. Hook connect/disconnect writes are atomic and retry if another process edits `~/.claude/settings.json` during PackRat's update window, so concurrent settings changes are merged rather than knowingly overwritten.

Queued prompts are capped at **9,000 characters** so PackRat's factual Stop feedback wrapper remains comfortably below Claude Code's 10,000-character `additionalContext` spill behavior. The wrapper describes the queued text as a user-authored next request rather than masquerading as an out-of-band system command.

The product is dependency-locked. `package-lock.json` is committed, CI installs with `npm ci`, and canonical `rat dev` also selects `npm ci` when the lockfile is present.

## Claude policy boundaries

Claude Code normally hot-loads direct hook edits from settings files, so connecting PackRat should not require a Claude restart. Interactive hooks still obey Claude's normal workspace-trust and policy system:

- The project must be trusted before settings-file hooks run in an interactive session.
- If `allowedHttpHookUrls` is defined anywhere in the effective settings stack, PackRat's `http://127.0.0.1:19741/hook` URL must match the merged allowlist. A non-matching HTTP hook is silently blocked by Claude Code.
- Enterprise `allowManagedHooksOnly` policy can prohibit user-level hooks entirely. PackRat must not claim a successful live integration in that managed configuration unless the administrator permits it.

For this reason, the setup page's file-level connection state is not itself proof that Claude is firing the hook. The real host gate requires receiving `UserPromptSubmit` from the target Claude session.

## Deterministic automated acceptance — PASS

The 21-test Windows fixture suite proves:

1. Claude version output is parsed and compared numerically.
2. Claude Code versions below 2.1.163 are rejected for Auto Queue integration.
3. Common Windows native, npm, and fallback Claude command discovery works without relying only on a potentially stale GUI-process PATH.
4. Existing Claude settings and hooks survive PackRat installation.
5. Hook installation is idempotent.
6. Disconnect removes only PackRat-owned hook handlers.
7. A random per-install hook token is used instead of a static localhost secret.
8. Hook authentication survives plugin/service restart without exposing the token in status output.
9. Settings writes are atomic and a first-change recovery backup is retained.
10. A concurrent Claude settings edit is preserved by retrying and merging the PackRat hook change.
11. The local server accepts only its canonical localhost Host header.
12. Local setup mutations require JSON and reject cross-site browser requests.
13. A queued prompt is emitted only at a Stop boundary using factual user-authored context.
14. Overlong queued prompts are rejected before PackRat approaches Claude's `additionalContext` spill threshold.
15. Background work prevents queue dequeue.
16. Six automatic continuations are allowed and item seven remains queued.
17. A fresh manual turn resets the continuation budget.
18. Permission and StopFailure states are explicit.
19. Multiple sessions never cause an arbitrary target guess.
20. Explicit session binding routes queued work only to the selected Claude session.
21. Queue state survives plugin/service restart.

The clean Windows CI gate installs the committed dependency graph with `npm ci`, builds the Stream Deck plugin, runs all fixtures, and passes `streamdeck validate` with the official Elgato CLI.

## Required Windows host gate

This is the one boundary a clean CI runner cannot prove because it requires an already authenticated, interactive Claude Code host session.

After `rat dev claude-auto-queue` links the spike plugin:

1. Open one normal Claude Code session in a safe, trusted test project. If Claude shows its workspace-trust prompt, accept trust for that test project before judging hook behavior.
2. Open `http://127.0.0.1:19741/` and verify the exact Claude version is shown as compatible. A session may already appear through best-effort agent discovery, but that is **not** a requirement.
3. Press **Connect Claude Code**. Existing `~/.claude/settings.json` content must remain intact.
4. Start a normal Claude turn. Verify the local page receives a `UserPromptSubmit` hook and the exact session now appears. This hook-learned `session_id` is the authoritative target. If no hook arrives, inspect `/hooks` plus any `allowedHttpHookUrls`, `disableAllHooks`, or managed hook policy before treating the architecture as failed.
5. While Claude is visibly working, enqueue two harmless follow-ups, for example `Reply with exactly: AUTO QUEUE STEP 1` and `Reply with exactly: AUTO QUEUE STEP 2`.
6. Do not type into Claude again. The first queued task must begin when the current turn stops, and the second must follow it in the **same conversation/session**.
7. Verify the queue count moves `2 -> 1 -> 0` and status progresses `WORKING -> WORKING -> FINISHED`.
8. Trigger a normal permission request in the safe test project and verify status changes to `NEED YOU` without approving anything automatically.
9. Queue one harmless follow-up, restart the Stream Deck plugin, and verify the queued item remains present.
10. Open two Claude sessions. Verify ambiguous Auto targeting refuses to guess, then explicitly bind a Queue Prompt key to one session and verify the other session cannot consume that queue.
11. Disconnect Claude Code integration and confirm only PackRat hook handlers are removed.

## GO / NO GO rule

**GO** only if host steps 1-11 pass without terminal automation, credential access, transcript mutation, or undocumented Claude internals.

**NO GO / redesign** if the Stop-hook continuation cannot reliably become the next same-session instruction, if hooks disturb normal Claude usage, or if session identity cannot be made fail-safe after accounting for documented Claude hook policy.

## UI direction after GO

The final product should use premium, restrained PackRat visual polish: dark graphite surfaces, strong typography, subtle depth, consistent status accents, and highly legible dynamic key faces. The visual reference is the quality level of PackRat's strongest competitive dashboard products, not a game or Counter-Strike visual theme.

Final product packaging should include a ready-made Stream Deck profile in addition to reusable individual actions, but the profile/art pass is intentionally deferred until the host gate proves the integration.
