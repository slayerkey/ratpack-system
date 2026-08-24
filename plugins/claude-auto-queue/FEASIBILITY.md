# Claude Auto Queue Feasibility Spike

## Current gate

**Automated feasibility: PASS.** The hardened spike passes Windows build, **19/19 deterministic regression tests**, the official Elgato Stream Deck validator, and the RatPack context checks.

**Interactive host feasibility: REQUIRED.** Do not merge or start final Marketplace polish until the signed-in Windows Claude Code same-session handoff is proven on a real user session.

## Product promise under test

Queue follow-up work for Claude Code from Stream Deck without interrupting the current turn, then hand each PackRat-owned queued prompt to the same Claude Code session when that turn naturally reaches a supported Stop hook boundary.

This spike deliberately does **not** claim access to Claude Code's private interactive queued-message UI.

## Supported Claude surfaces used

The spike is intentionally limited to documented Claude Code integration surfaces:

- HTTP hooks written into the user's normal `~/.claude/settings.json` hook configuration.
- `UserPromptSubmit` to identify a fresh manual turn and reset the automatic continuation budget.
- `Stop` with `hookSpecificOutput.additionalContext` to continue the same conversation with the next PackRat queued prompt.
- `PermissionRequest`, `Notification`, `PermissionDenied`, `PostToolUse`, and `PostToolUseFailure` for attention-state transitions.
- `StopFailure` for explicit API, authentication, rate-limit, overload, billing, and related failure states.
- `TaskCreated` and `TaskCompleted` only as optional display enrichment.
- `claude agents --json` as a read-only reconciliation source for live session identity and waiting state.

Claude Code **2.1.163 or newer** is required. The local setup page refuses to connect the PackRat hooks on older or unparseable versions because the product depends on supported Stop-hook `additionalContext` continuation.

No Claude credentials are read, copied, uploaded, or modified. No hosted service is used. No terminal keystroke injection is used.

## Deliberate safety and integrity limits

Claude Code has its own eight-consecutive Stop-hook continuation guard. PackRat caps one automatic chain at **6 queued follow-ups** after a fresh manual user turn, leaving margin below Claude's guard.

When the cap is reached, later work remains queued and the session becomes `NEED YOU` rather than pretending the remaining items ran.

The queue does not advance while a Stop event reports background tasks or session cron work that can wake the session again.

If multiple Claude sessions are visible and no exact active session has been learned from hooks or explicitly selected, the plugin refuses to guess. The Property Inspector and local setup page both support explicit session binding.

PackRat hook requests carry a random per-install token in the configured HTTP-hook header. The localhost hook endpoint uses constant-time token comparison and does not expose the token in diagnostics.

The local setup API binds only to `127.0.0.1`, requires its canonical Host header, and rejects cross-site or non-JSON mutation requests. The diagnostics page also sets restrictive browser security headers.

PackRat keeps a first-change recovery backup of Claude settings. Hook connect/disconnect writes are atomic and retry if another process edits `~/.claude/settings.json` during PackRat's update window, so concurrent settings changes are merged rather than knowingly overwritten.

## Deterministic automated acceptance — PASS

The 19-test Windows fixture suite proves:

1. Claude version output is parsed and compared numerically.
2. Claude Code versions below 2.1.163 are rejected for Auto Queue integration.
3. Existing Claude settings and hooks survive PackRat installation.
4. Hook installation is idempotent.
5. Disconnect removes only PackRat-owned hook handlers.
6. A random per-install hook token is used instead of a static localhost secret.
7. Hook authentication survives plugin/service restart without exposing the token in status output.
8. Settings writes are atomic and a first-change recovery backup is retained.
9. A concurrent Claude settings edit is preserved by retrying and merging the PackRat hook change.
10. The local server accepts only its canonical localhost Host header.
11. Local setup mutations require JSON and reject cross-site browser requests.
12. A queued prompt is emitted only at a Stop boundary.
13. Background work prevents queue dequeue.
14. Six automatic continuations are allowed and item seven remains queued.
15. A fresh manual turn resets the continuation budget.
16. Permission and StopFailure states are explicit.
17. Multiple sessions never cause an arbitrary target guess.
18. Explicit session binding routes queued work only to the selected Claude session.
19. Queue state survives plugin/service restart.

The clean Windows CI gate also builds the Stream Deck plugin and passes `streamdeck validate` with the official Elgato CLI.

## Required Windows host gate

This is the one boundary a clean CI runner cannot prove because it requires an already authenticated, interactive Claude Code host session.

After `rat dev claude-auto-queue` links the spike plugin:

1. Open one normal Claude Code session in a safe test project.
2. Open `http://127.0.0.1:19741/` and verify the exact Claude version is shown as compatible and the session appears.
3. Press **Connect Claude Code**. Existing `~/.claude/settings.json` content must remain intact.
4. Start a normal Claude turn.
5. While Claude is visibly working, enqueue two harmless follow-ups, for example `Reply with exactly: AUTO QUEUE STEP 1` and `Reply with exactly: AUTO QUEUE STEP 2`.
6. Do not type into Claude again. The first queued task must begin when the current turn stops, and the second must follow it in the **same conversation/session**.
7. Verify the queue count moves `2 -> 1 -> 0` and status progresses `WORKING -> WORKING -> FINISHED`.
8. Trigger a normal permission request in the safe test project and verify status changes to `NEED YOU` without approving anything automatically.
9. Queue one harmless follow-up, restart the Stream Deck plugin, and verify the queued item remains present.
10. Open two Claude sessions. Verify ambiguous Auto targeting refuses to guess, then explicitly bind a Queue Prompt key to one session and verify the other session cannot consume that queue.
11. Disconnect Claude Code integration and confirm only PackRat hook handlers are removed.

## GO / NO GO rule

**GO** only if host steps 1-11 pass without terminal automation, credential access, transcript mutation, or undocumented Claude internals.

**NO GO / redesign** if the Stop-hook continuation cannot reliably become the next same-session instruction, if hooks disturb normal Claude usage, or if session identity cannot be made fail-safe.

## UI direction after GO

The final product should use premium, restrained PackRat visual polish: dark graphite surfaces, strong typography, subtle depth, consistent status accents, and highly legible dynamic key faces. The visual reference is the quality level of PackRat's strongest competitive dashboard products, not a game or Counter-Strike visual theme.

Final product packaging should include a ready-made Stream Deck profile in addition to reusable individual actions, but the profile/art pass is intentionally deferred until the host gate proves the integration.
