# Discord commercial RPC approval boundary

PackRat Voice Deck requires the same Discord RPC scopes already documented for PackRat Voice Bridge and PackRat Voice Panel:

```text
rpc
rpc.voice.read
rpc.voice.write
```

Canonical policy and request text live at `plugins/discord-bridge/DISCORD_APPROVAL.md`.

Voice Deck must remain `BLOCKED` for public Marketplace submission until one of these is true:

1. Discord approves a PackRat-owned production application for the required RPC scopes and the plugin is migrated to Discord's approved production token exchange architecture.
2. Discord gives explicit written permission to use the existing StreamKit identity/token exchange path in third-party commercial software.

Anything short of explicit permission is not a release approval.

After the Discord path is approved, Voice Deck still needs the real Windows Discord / physical Stream Deck packaged-plugin smoke named in `products/voice-deck.json` before moving to `READY_TO_SHIP`.

No client secret may ever be embedded in the Stream Deck plugin. If Discord's approved flow requires a confidential exchange, that secret belongs in minimal PackRat-controlled server infrastructure and only the resulting session token may reach the local plugin process.
