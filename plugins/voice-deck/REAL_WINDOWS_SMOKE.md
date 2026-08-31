# Voice Deck Real Windows Smoke

Status: NOT RUN

Automated runtime candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Tested runtime tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Windows release workflow: `33329108034` PASS

Exact packaged `.streamDeckPlugin` SHA256 from that release run:

`54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

The later host-audit tooling lives outside the packaged `.sdPlugin` runtime. The real smoke must record the exact Rat Dev commit it actually activates.

## One-pass preferred test

Start Discord Desktop and Stream Deck, join a real Discord voice channel with at least one other participant if available, then run:

```text
rat dev voice-deck
```

After Rat Dev succeeds:

```text
cd out\dev\worktrees\voice-deck\plugins\voice-deck
npm run host:audit
```

The audit saves `HOST_AUDIT_LATEST.txt`. Keep that file if anything is wrong. Do not uninstall first because uninstalling a Stream Deck plugin also removes its plugin logs.

If Discord authorization or voice state is the unclear layer, run this diagnostic without changing mute/deafen automatically:

```text
npm run host:probe
```

`host:probe` uses the same development Discord transport path as Voice Deck, prints only redacted state, keeps credentials memory-only, and never prints token values. It isolates Discord IPC/auth/channel/roster behavior from Stream Deck rendering.

## Required physical checks

1. Discord Desktop is detected.
2. Real Discord authorization succeeds.
3. Current voice channel resolves.
4. Real members populate Dynamic Member Slot keys.
5. Speaking state updates on the correct real keys.
6. Toggle Mute changes Discord and the Stream Deck state immediately.
7. Toggle Deafen changes Discord and the Stream Deck state immediately.
8. Discord UI mute/deafen changes are reflected back on Stream Deck.
9. Switching voice channels repopulates the dashboard cleanly without stale members.
10. Discord restart reconnects without reinstalling the plugin.
11. Stream Deck restart reconnects without repeating setup unnecessarily.
12. Included MK.2, XL, Plus, and Neo profiles import on the matching supported device/software where available. Confirm the Plus dial rotates through members, press toggles mute, and touch toggles deafen.
13. The packaged `.streamDeckPlugin` behaves like the development build for authorization, channel following, roster, speaking state, mute, deafen, reconnect, and profile loading.

## Failure handoff

If anything fails, do not start a long reinstall/retry loop. Send only:

1. `HOST_AUDIT_LATEST.txt`
2. the full output of `npm run host:probe` if the Discord layer is involved
3. one sentence describing the visible mismatch
4. one screenshot only if the problem is visual

That is enough to separate environment, Discord transport, Stream Deck host, plugin runtime, and display problems before changing code.

## Packaged parity

After checks 1 through 12 pass in Rat Dev, install the exact packaged `.streamDeckPlugin` from the recorded release artifact and repeat the critical parity checks in item 13. Verify its SHA256 matches the recorded package hash before treating it as the release candidate.

## Pass record

When complete, replace `Status: NOT RUN` with `Status: PASS` and record:

* Windows version
* Discord Desktop version
* Stream Deck software version
* Stream Deck hardware tested
* exact Rat Dev source commit
* packaged plugin SHA256
* date tested
* any device/profile not physically available
* whether `host:audit` finished PASS or WARN and why

Do not mark this file passed based only on mocks, CI, screenshots, `host:probe`, or `streamdeck validate`.
