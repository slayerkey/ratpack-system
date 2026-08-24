# Work Session Tracker Pro QA

Automated release QA uses the same shared timestamp/state test harness as Lite and runs against the packaged Pro `index.html` in CI.

It covers all eight official XENEON sizes, 44×44 minimum visible button targets, long-session derivation, pause/resume/finish transitions, restart recovery, paused recovery, midnight allocation, active clock-jump protection, DST day boundaries, history limits, saved projects, break exclusion and safe manual correction.

Retention: Pro keeps at most 1,500 completed sessions and 120 days of local history, plus at most 30 saved projects.

Notes and file export are deliberately not part of V1. They add keyboard/file-system surface area without improving the core focus-accountability loop and would require separate host verification.
