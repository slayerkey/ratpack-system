# Auto Queue for Claude Code final Windows host smoke

**HOST SMOKE: PASS — 2026-08-25**

The final release-candidate smoke was completed on a real Windows Stream Deck + VS Code Claude Code host. No release-blocking behavior was observed.

## Confirmed host behavior

1. **NEED YOU**
   - Claude permission/attention state surfaces without PackRat approving or denying anything.

2. **Restart persistence**
   - Queued work survives the Stream Deck/plugin restart path and remains associated with the intended Claude chat.

3. **Explicit two-chat routing**
   - Explicit targeting remains isolated to the selected Claude chat and Auto does not guess when targeting is ambiguous.

4. **Disconnect cleanup**
   - Disconnect leaves Claude functioning normally, removes only PackRat-owned integration, and reconnect remains available.

5. **Physical profile and queued prompt behavior**
   - The packaged actions/profile render and operate on the physical host.
   - Repeated real queue round trips completed successfully.
   - A normal Claude user message activates the chat for Auto targeting.
   - A Queue Prompt does not send immediately or interrupt the current response.
   - When Claude reaches the end of the current turn, the queued prompt is supplied as the next request in the same conversation.
   - The observed test output matched the queued text, confirming the round trip.

## User-facing behavior that must remain explicit

Auto Queue works differently from an immediate “send message” action:

1. Connect Claude Code once.
2. Send one normal message in the Claude chat you want to use so PackRat can learn that active chat from the supported hook event.
3. While Claude is working, queue the follow-up from Stream Deck or Setup.
4. The queued request waits locally and becomes Claude's next request only after the current turn finishes.

If Auto says it is waiting for a chat, the user should send one normal Claude message first. Exact session identifiers remain diagnostic-only.

## Remaining release boundary

Physical host QA is complete. Remaining work before Marketplace submission is:

1. Explicitly approve and set `submission.price_usd` plus the matching product registry price.
2. Merge PR #70 to `main` after the final release CI is green.
3. Run `rat stage claude-auto-queue` for a final Maker Console review, or `rat ship claude-auto-queue` when ready to submit.
