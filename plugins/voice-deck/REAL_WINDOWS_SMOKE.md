# Voice Deck Real Windows Smoke

Status: NOT RUN

Automated runtime candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Tested runtime tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Windows release workflow: `33329108034` PASS

Exact packaged `.streamDeckPlugin` SHA256 from that release run:

`54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

The host diagnostic tooling lives outside the packaged `.sdPlugin` runtime. The real smoke must record the exact Rat Dev commit it actually activates.

## One-pass preferred test

Start Discord Desktop and Stream Deck, join a real Discord voice channel with at least one other participant if available, then run exactly:

```text
rat dev voice-deck
rat audit voice-deck
```

`rat dev` fetches the canonical product source, installs locked dependencies when needed, builds, tests, runs official Elgato validation, links the validated development plugin, and restarts it.

`rat audit` then resolves the exact active Rat Dev source, checks the local Voice Deck build, manifest, profiles, Discord Desktop process, Discord IPC named pipes, Stream Deck process, plugin logs, and Stream Deck host logs. It saves `HOST_AUDIT_LATEST.txt` inside the Voice Deck product root. Keep that file if anything is wrong. Do not uninstall first because uninstalling a Stream Deck plugin also removes its plugin logs.

If Discord authorization or live voice state is the unclear layer, run:

```text
rat audit voice-deck --probe
```

The deep probe first runs the normal host audit, then uses the same development Discord transport path as Voice Deck. It prints only redacted state, keeps credentials memory-only, never prints token values, and never toggles mute or deafen automatically. It isolates Discord IPC, authorization, channel, roster, and speaking-event behavior from Stream Deck rendering.

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
2. the full output of `rat audit voice-deck --probe` if the Discord layer is involved
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
* whether `rat audit voice-deck` finished PASS or WARN and why

Do not mark this file passed based only on mocks, CI, screenshots, `rat audit voice-deck --probe`, or `streamdeck validate`.
