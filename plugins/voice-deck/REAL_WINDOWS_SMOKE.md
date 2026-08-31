# Voice Deck Real Windows Smoke

Status: NOT RUN

Canonical source commit: `f8a084287b0bfcb82785710a22b6ca2dcb142947`

Automated release candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Tested source tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Windows release workflow: `33329108034` PASS

Exact packaged `.streamDeckPlugin` SHA256 to test:

`54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

## Preferred test path

First run:

```text
rat dev voice-deck
```

This validates the canonical source, links the development plugin, and gives the exact active plugin identity. Complete checks 1 through 12 below against that build.

Then install the exact packaged `.streamDeckPlugin` from the release artifact and repeat the critical parity checks in item 13.

## Required checks

1. Discord Desktop is detected.
2. Real Discord authorization succeeds.
3. Current voice channel resolves.
4. Real members populate Dynamic Member Slot keys.
5. Speaking state updates on real keys.
6. Toggle Mute changes Discord and the Stream Deck state immediately.
7. Toggle Deafen changes Discord and the Stream Deck state immediately.
8. Discord UI mute/deafen changes are reflected back on Stream Deck.
9. Switching voice channels repopulates the dashboard cleanly without stale members.
10. Discord restart reconnects without reinstalling the plugin.
11. Stream Deck restart reconnects without repeating setup unnecessarily.
12. Included MK.2, XL, Plus, and Neo profiles import on the matching supported device/software where available. Confirm the Plus dial rotates through members, press toggles mute, and touch toggles deafen.
13. The packaged `.streamDeckPlugin` behaves like the development build for authorization, channel following, roster, speaking state, mute, deafen, reconnect, and profile loading.

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

Do not mark this file passed based only on mocks, CI, screenshots, or `streamdeck validate`.
