# Voice Deck Architecture

## Decision

Voice Deck directly contains the proven local Discord IPC transport rather than requiring the free Voice Bridge as a helper process.

This produces the lowest-friction customer flow: one Stream Deck plugin, one Discord authorization boundary, and no localhost helper chain to explain.

## State model

One `VoiceSession` owns:

* Discord pipe connection and authorization state
* current Discord account
* current server when available
* selected voice channel
* normalized member roster
* speaking state and speaker timestamps
* self mute and deafen state
* freshness timestamps and errors

Every Stream Deck action subscribes to this normalized model. Actions never create their own Discord connections.

## Rendering

Visible actions are registered centrally. State changes are coalesced before rendering, and `setImage` is skipped when the rendered data URI is identical to the previous value for that action.

Dynamic member slots use stable roster order by default, with self pinned first when present. Speaking users do not reorder the physical keys. The separate Speaker Spotlight action handles active speaker prominence with a 900 ms hold window to avoid flicker.

## Avatars

Discord CDN avatars are fetched without credentials, capped by response size, cached only in process memory, and bounded to a small cache. Missing or failed avatars fall back to deterministic initials.

## Stream Deck +

Voice Navigator is an Encoder action. Rotation browses the live roster, dial press toggles mute, touch toggles deafen, and the touch strip displays the selected member or current voice state. No fake per-member volume control is exposed.
