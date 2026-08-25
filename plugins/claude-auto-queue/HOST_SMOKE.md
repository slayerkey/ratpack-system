# Auto Queue for Claude Code final Windows host smoke

This is the only manual QA still required before Marketplace submission. The architecture and automated release gates are already PASS.

## Install the current product branch

```text
rat dev claude-auto-queue
```

Keep Claude Code open in a trusted VS Code workspace and keep Stream Deck running.

## 1. NEED YOU

1. Start a harmless Claude task that requires a normal tool permission prompt.
2. Do not approve it immediately.
3. Confirm the Claude Status key changes to **NEED YOU**.
4. Confirm Auto Queue does not approve or deny the permission for you.
5. Resolve the prompt normally in Claude.

PASS: the deck asks for attention while Claude's own permission flow remains authoritative.

## 2. Restart persistence

1. While Claude is working, queue one harmless follow-up from Stream Deck.
2. Confirm the Next Prompt key shows it.
3. Restart the Auto Queue plugin through Stream Deck or restart Stream Deck.
4. Do not send a new Claude prompt during the restart.
5. Confirm the same queued request returns for the same Claude chat.
6. Let the current Claude turn finish and confirm the queued request runs once.

PASS: queue state survives the host restart and does not duplicate or disappear.

## 3. Explicit two-chat routing

1. Open two live Claude Code chats.
2. In one Queue Prompt key's Property Inspector, choose one specific chat instead of Auto.
3. Queue a harmless uniquely named request from that key.
4. Let both chats reach normal turn boundaries.

PASS: only the explicitly selected chat consumes the request. If targeting is ambiguous, PackRat must refuse rather than guess.

## 4. Disconnect cleanup

1. Open Auto Queue Setup.
2. Click **Disconnect**.
3. Confirm Claude continues to work normally.
4. Confirm PackRat reports its integration disconnected.
5. If inspecting Claude settings, only PackRat-owned hook handlers should be gone; unrelated settings/hooks must remain.
6. Click **Connect Claude Code** again before normal use.

PASS: Disconnect removes only PackRat integration and reconnect remains one-click.

## 5. Packaged profile and ready-made prompt

1. Confirm the included profile/actions render correctly on the physical Stream Deck you use.
2. Press one ready-made Queue Prompt key such as **Continue** or **Run Tests** while Claude is already working.
3. Confirm the key shows queued feedback and Claude is not interrupted.
4. Confirm the request runs only after the current Claude turn reaches its supported Stop boundary.

PASS: the packaged experience works as a complete command center, not only as individually configured actions.

## Final result

If all five checks pass, record **HOST SMOKE: PASS** in `QA.md`, approve the Marketplace price, merge the product PR, then use:

```text
rat stage claude-auto-queue
```

for a final Maker Console review, or:

```text
rat ship claude-auto-queue
```

when the listing is ready to submit.
