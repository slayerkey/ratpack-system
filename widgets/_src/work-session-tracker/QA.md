# Work Session Tracker Lite QA

Automated release QA is implemented in `network-smoke.mjs` through the canonical packaged-widget CI hook.

The test opens the packaged widget at all eight official XENEON sizes, rejects viewport overflow, and verifies every visible button is at least 44×44 CSS pixels. It covers start, pause, resume, finish, accidental duplicate finish, a simulated 3+ hour session, restart recovery, paused restart recovery, midnight allocation, active clock-jump protection, DST day boundaries in America/New_York, history pruning, and the official Link Provider upgrade route.

Retention: Lite intentionally exposes only today. Internally it retains at most 150 completed sessions and prunes completed data older than 8 days so local storage cannot grow forever.

Physical hardware remains an optional confidence tier after browser fixtures, official CORSAIR package validation and StreamSpell pass.
