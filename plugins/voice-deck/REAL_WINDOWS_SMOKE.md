# Voice Deck Real Windows Smoke

Status: NOT RUN FOR THE CURRENT VOICE DECK CANDIDATE

Record the exact candidate commit when this is executed.

## Required checks

1. Discord Desktop is detected.
2. Real Discord authorization succeeds.
3. Current voice channel resolves.
4. Real members populate Dynamic Member Slot keys.
5. Speaking state updates on real keys.
6. Toggle Mute changes Discord and the Stream Deck state immediately.
7. Toggle Deafen changes Discord and the Stream Deck state immediately.
8. Discord UI changes are reflected back on Stream Deck.
9. Switching voice channels repopulates the dashboard cleanly.
10. Discord restart reconnects without reinstalling the plugin.
11. Stream Deck restart reconnects.
12. Included MK.2, XL, Plus, and Neo profiles import on the matching supported device/software where available.
13. The packaged `.streamDeckPlugin` behaves like the development build.

Do not mark this file passed based only on mocks, CI, screenshots, or `streamdeck validate`.
