# Claude Auto Queue Feasibility Spike

## Product promise under test

Queue follow-up work for Claude Code from Stream Deck without interrupting the current turn, then hand each PackRat-owned queued prompt to the same Claude Code session when that turn naturally reaches a supported Stop hook boundary.

This spike deliberately does **not** claim access to Claude Code's private interactive queued-message UI.

## Supported Claude surfaces used

The spike is intentionally limited to documented Claude Code integration surfaces:

- HTTP hooks written into the user's normal `~/.claude/settings.json` hook configuration.
- `UserPromptSubmit` to identify a fresh manual turn and reset the automatic continuation budget.
- `Stop` with `hookSpecificOutput.additionalContext` to continue the same session with the next PackRat queued prompt.
- `PermissionRequest`, `Notification`, `PermissionDenied`, `PostToolUse`, and `PostToolUseFailure` for attention-state transitions.
- `StopFailure` for explicit API, authentication, rate-limit, overload, billing, and related failure states.
- `TaskCreated` and `TaskCompleted` only as optional display enrichment.
- `claude agents --json` as a read-only reconciliation source for live session identity and waiting state.

No Claude credentials are read, copied, uploaded, or modified. No hosted service is used. No terminal keystroke injection is used.

## Deliberate safety limits

Claude Code has its own consecutive Stop-hook continuation guard. PackRat caps one automatic chain at **6 queued follow-ups** after a fresh manual user turn, leaving margin below Claude's documented hard guard.

When the cap is reached, later work remains queued and the session becomes `NEED YOU` rather than pretending the remaining items ran.

The queue also does not advance while a Stop event reports background tasks or session cron work that can wake the session again.

If multiple Claude sessions are visible and no exact active session has been learned from hooks or explicitly selected, the plugin refuses to guess.

## Deterministic spike acceptance

Automated tests must prove:

1. Existing Claude settings and hooks survive installation.
2. Hook installation is idempotent.
3. Disconnect removes only PackRat-owned hook handlers.
4. Settings writes are atomic and a first-change recovery backup is retained.
5. A queued prompt is emitted only at a Stop boundary.
6. Background work prevents queue dequeue.
7. Six automatic continuations are allowed and item seven remains queued.
8. A fresh manual turn resets the continuation budget.
9. Permission and StopFailure states are explicit.
10. Multiple sessions never cause an arbitrary target guess.
11. Queue state survives plugin/service restart.

## Required Windows host gate

This is the one boundary a clean CI runner cannot prove because it requires an already authenticated, interactive Claude Code host session.

After `rat dev claude-auto-queue` links the spike plugin:

1. Open one normal Claude Code session in a safe test project.
2. Open `http://127.0.0.1:19741/` and verify the exact Claude version and session appear.
3. Press **Connect Claude Code**. Existing `~/.claude/settings.json` content must remain intact.
4. Start a normal Claude turn.
5. While Claude is visibly working, enqueue two harmless follow-ups, for example `Reply with exactly: AUTO QUEUE STEP 1` and `Reply with exactly: AUTO QUEUE STEP 2`.
6. Do not type into Claude again. The first queued task must begin when the current turn stops, and the second must follow it in the **same session**.
7. Verify the queue count moves 2 -> 1 -> 0 and the status progresses WORKING -> WORKING -> FINISHED.
8. Trigger a normal permission request in the safe test project and verify the status changes to NEED YOU without approving anything automatically.
9. Queue one harmless follow-up, restart the Stream Deck plugin, and verify the queued item remains present.
10. With two Claude sessions open and no known active target, verify Queue Prompt refuses to guess and asks for a session rather than sending to the wrong project.
11. Disconnect Claude Code integration and confirm only PackRat hook handlers are removed.

## GO / NO GO rule

**GO** only if steps 1-11 above pass without terminal automation, credential access, transcript mutation, or undocumented Claude internals.

**NO GO / redesign** if the Stop-hook continuation cannot reliably become the next same-session instruction, if hooks disturb normal Claude usage, or if session identity cannot be made fail-safe.

## UI direction after GO

The final product should use premium, restrained PackRat visual polish: dark graphite surfaces, strong typography, subtle depth, consistent status accents, and highly legible dynamic key faces. The visual reference is the quality level of PackRat's strongest competitive dashboard products, not a game or Counter-Strike visual theme.

Final product packaging should include a ready-made Stream Deck profile in addition to reusable individual actions, but the profile/art pass is intentionally deferred until the host gate proves the integration.
