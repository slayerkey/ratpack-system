# PackRat Voice Deck

PackRat Voice Deck is the paid Stream Deck-native Discord voice dashboard and control plugin.

It is intentionally independent from PackRat Voice Bridge and PackRat Voice Panel. Voice Deck owns one local Discord Desktop RPC session itself, normalizes that state once, and fans it out to every visible Stream Deck action.

## Actions

1. Voice Status
2. Toggle Mute
3. Toggle Deafen
4. Mute + Deafen
5. Current Voice Channel
6. Voice Member
7. Dynamic Member Slot
8. Speaker Spotlight
9. Voice Activity
10. Voice Member Count
11. Discord Connection
12. Voice Navigator for Stream Deck +

## Included profiles

* Voice Dashboard for Stream Deck MK.2 and other 5 by 3 devices
* Voice Dashboard XL
* Voice Dashboard Plus
* Compact Voice Neo

The profile generator is deterministic and produces current V2 `.streamDeckProfile` archives during the build.

## Setup

1. Install the plugin or run `rat dev voice-deck`.
2. Keep Discord Desktop open on Windows.
3. Add Voice Deck actions or use an included profile.
4. Press Discord Connection if authorization is required.
5. Join a Discord voice channel.

Voice Deck follows voice channel changes automatically.

## Real host diagnostics

After `rat dev voice-deck`, run:

```text
rat audit voice-deck
```

This resolves the exact active Rat Dev source and writes one shareable `HOST_AUDIT_LATEST.txt` covering source identity, manifest, profiles, Windows version, Discord Desktop process/version, Discord IPC named pipes, Stream Deck process/version, plugin logs, and Stream Deck host logs.

If the Discord transport itself is unclear, run:

```text
rat audit voice-deck --probe
```

The probe first runs the normal audit, then exercises the same development Discord IPC/auth/channel/roster path as Voice Deck. It prints only redacted state, keeps session credentials in memory, never prints token values, and never toggles mute or deafen automatically.

Use `REAL_WINDOWS_SMOKE.md` as the canonical physical release checklist. Neither diagnostic replaces the physical Stream Deck smoke.

## Release boundary

Development uses the same proven Discord StreamKit RPC feasibility path as PackRat Voice Bridge. Public commercial release remains fail-closed until Discord grants the PackRat production application the required RPC scopes or explicitly permits the StreamKit production path. See `DISCORD_APPROVAL.md`.
