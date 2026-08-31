# Discord commercial release approval

Status: CLEARED BY OPERATOR CONFIRMATION

Product: `PackRat Voice Deck for Discord`

Required Discord RPC capabilities:

```text
rpc
rpc.voice.read
rpc.voice.write
```

The real Windows Discord / physical Stream Deck packaged-plugin smoke is complete and recorded as PASS in `plugins/voice-deck/REAL_WINDOWS_SMOKE.md` and `products/voice-deck.json`.

On 2026-08-30 the operator explicitly confirmed that the Discord commercial release approval had arrived and instructed release tooling to proceed without independently re-verifying the external approval message. That confirmation clears the Voice Deck public-release gate for this repository state.

The operator also approved proceeding with the customer-facing product name:

```text
PackRat Voice Deck for Discord
```

For this release pass the current tested Discord transport is treated as the approved production path. No runtime authentication migration is being introduced after the completed physical smoke.

No client secret may ever be embedded in the Stream Deck plugin. Discord session credentials remain process-memory only under the tested architecture.

Canonical release state is `READY_TO_SHIP`. Public submission is performed with:

```text
rat ship voice-deck
```

Exact external support ticket metadata was not copied into the repository because the operator explicitly requested proceeding without a separate verification pass.
