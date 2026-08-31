# Voice Deck Real Windows Smoke

Status: PASS

Automated runtime candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Tested runtime tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Windows release workflow: `33329108034` PASS

Original automated release package SHA256:

`54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

Final physically checked centered-avatar package SHA256:

`ec5d09c3db484a0c83b57f3f2d3b205106eca06a0e22f8c4c1cc672fe248fab5`

## Pass record

* Date tested: 2026-08-30 local host time
* Windows: Microsoft Windows 11 Home 10.0.26200 (build 26200)
* Discord Desktop: 1.0.9255
* Stream Deck software: 7.5.0.22885
* Stream Deck hardware/layout tested: 5 by 3 Voice Dashboard layout; exact hardware model was not separately recorded in the handoff
* Exact Rat Dev source commit used for host audit and deep transport probe: `fa9b73f1d0ba47e59616fb4c40223c49d0ac8c31`
* Final product branch commit containing the centered avatar renderer: `a2a768f15d349e13165a505d8902e2fda165e880`
* Final checked package SHA256: `ec5d09c3db484a0c83b57f3f2d3b205106eca06a0e22f8c4c1cc672fe248fab5`
* `rat audit voice-deck`: WARN only because 52 historical plugin-log matches remained in the latest 400 lines; manifest, runtime, profiles, Windows, Discord process/version, Stream Deck process/version, Discord IPC, plugin log, host log, and host registration all passed
* Deep Discord probe: PASS with authenticated RPC, `rpc.voice.read`, `rpc.voice.write`, active voice channel, live member roster, and no transport/auth error
* Physical behavior confirmed by the operator: current channel, member count, real member population, speaking and recent-speaking states, Speaker Spotlight, mute/deafen state reflection, channel repopulation, and the remaining control/recovery checks requested during the smoke
* Final visual parity: operator installed the centered-avatar `.streamDeckPlugin` and confirmed the avatar/ring alignment looks correct
* XL, Plus, and Neo hardware were not separately identified as physically available during this handoff; their generated profiles remain covered by automated build/validation where physical hardware was unavailable

## Required physical checks

1. Discord Desktop is detected. PASS
2. Real Discord authorization succeeds. PASS
3. Current voice channel resolves. PASS
4. Real members populate Dynamic Member Slot keys. PASS
5. Speaking state updates on the correct real keys. PASS
6. Toggle Mute changes Discord and the Stream Deck state immediately. PASS by operator confirmation
7. Toggle Deafen changes Discord and the Stream Deck state immediately. PASS by operator confirmation
8. Discord UI mute/deafen changes are reflected back on Stream Deck. PASS by operator confirmation
9. Switching voice channels repopulates the dashboard cleanly without stale members. PASS
10. Discord restart reconnects without reinstalling the plugin. PASS by operator confirmation
11. Stream Deck restart reconnects without repeating setup unnecessarily. PASS by operator confirmation
12. Included MK.2, XL, Plus, and Neo profiles build and validate; matching physical devices were checked where available. PASS with unavailable-device note above
13. The packaged `.streamDeckPlugin` behaves like the tested development build for the exercised release-critical behavior. PASS; the final post-smoke code change was limited to avatar rendering geometry and was physically rechecked in the packaged build

## Evidence notes

The host diagnostic and deep probe established the Discord transport independently from Stream Deck rendering. The physical Stream Deck screenshots then showed real channel/member state, speaking/recent-speaking transitions, deafen state, roster repopulation, and the final centered-avatar packaged renderer. The operator explicitly authorized closing the remaining physical checks after testing.

Public commercial release is still a separate boundary. This PASS does not grant Discord production RPC permission and does not remove the Rat Ship approval guard by itself.
