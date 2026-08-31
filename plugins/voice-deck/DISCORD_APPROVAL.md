# Discord commercial RPC approval boundary

PackRat Discord Voice Deck requires the same Discord RPC scopes already documented for PackRat Voice Bridge and PackRat Voice Panel:

```text
rpc
rpc.voice.read
rpc.voice.write
```

Canonical policy and request text live at `plugins/discord-bridge/DISCORD_APPROVAL.md`.

Discord Voice Deck must remain `BLOCKED` for public Marketplace submission until one of these is true:

1. Discord approves a PackRat-owned production application for the required RPC scopes and the plugin is migrated to Discord's approved production token exchange architecture.
2. Discord gives explicit written permission to use the existing StreamKit identity/token exchange path in third-party commercial software.

Anything short of explicit permission is not a release approval.

The real Windows Discord / physical Stream Deck packaged-plugin smoke is already complete and recorded as PASS in `plugins/voice-deck/REAL_WINDOWS_SMOKE.md` and `products/voice-deck.json`. Discord production permission is the only remaining public-release blocker.

No client secret may ever be embedded in the Stream Deck plugin. If Discord's approved flow requires a confidential exchange, that secret belongs in minimal PackRat-controlled server infrastructure and only the resulting session token may reach the local plugin process.
