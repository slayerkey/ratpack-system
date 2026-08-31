# Ultimate Per-App Audio — Real Windows Host Test

This folder is experimental and is **not part of the accepted v0.7.1 plugin**.

Use this only to prove whether Windows Core Audio application sessions behave correctly on a normal desktop audio host before the feature is promoted into Ultimate.

## Fastest path

Open Command Prompt in this folder.

### 1. Inventory only

```bat
run-host-test.cmd
```

This is read-only. It reports the currently visible Windows application audio sessions.

Useful result states:

- `audit-only-needs-target` — audio endpoint works and the inventory was generated
- `audio-endpoint-unavailable-or-error` — Windows exposed no usable playback endpoint to the helper

### 2. Check one app without changing anything

```bat
run-host-test.cmd -Process Discord
```

or

```bat
run-host-test.cmd -Process Spotify
```

This remains read-only.

Expected states:

- `read-only-pass` — exact process session found
- `waiting-no-session` — the app has no current Core Audio session; play audio in the app and run it again

Matching is exact after normalizing `.exe`. `Discord` does not intentionally match `DiscordHelper`.

### 3. Reversible 1% write test

Only after the read-only result looks correct:

```bat
run-host-test.cmd -Process Discord -Exercise
```

The harness will only exercise the write if the target resolves safely.

It changes volume by exactly 1 percentage point, verifies the observed value, restores the original value, and verifies the restoration.

Expected success:

`write-and-restore-pass`

Safety refusals are intentional:

- `exercise-refused-multiple-pids` — more than one process PID matched. Re-run with the exact PID from the audit, for example `-Pid 1234 -Exercise`.
- `exercise-refused-mixed-volume` — one PID exposes sessions with different volume values. The harness refuses to flatten that state merely for a test.

The harness never modifies mute state.

## Save the result to a file

```bat
run-host-test.cmd -Process Discord -OutputPath discord-audio-audit.json
```

For the reversible test:

```bat
run-host-test.cmd -Pid 1234 -Exercise -OutputPath discord-audio-write-test.json
```

That JSON result is enough to diagnose the next layer without a button-by-button Stream Deck debugging loop.

## What this proves

A successful `write-and-restore-pass` proves, on that Windows machine and current audio stack:

- the default playback endpoint can expose app sessions
- the target application session can be identified
- a PID-scoped Core Audio volume write works
- the change is observable on a second enumeration
- the original volume can be restored

It does **not** by itself prove:

- Stream Deck+ dial latency
- foreground Current App tracking
- Discord/game/music multi-channel presets
- device-switch behavior
- microphone behavior

Those remain separate acceptance gates.

## Promotion rule

Do not merge per-app audio into the accepted Ultimate plugin only because CI passes. At least one normal Windows desktop must produce a successful read-only app result and a successful reversible write/restore result first.
