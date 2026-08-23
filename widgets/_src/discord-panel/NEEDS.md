# Discord Voice Panel needs

## Release blockers

1. Replace the placeholder Discord application Client ID after the owner creates the application.
2. Re-probe ports 6463 through 6472 with the real Client ID and Origin null.
3. Prove a safe token acquisition path that does not embed or expose a Discord client secret. Discord's current legacy WebSocket RPC documentation returns an authorization code from AUTHORIZE and directs clients to the standard OAuth2 token exchange. The current standard exchange is confidential-client oriented. Do not ship until this is resolved with an approved public-client flow or another safe architecture.
4. Obtain Discord approval for rpc.voice.read and rpc.voice.write before marketplace submission. Current Discord documentation labels WebSocket RPC deprecated and available only to old private beta participants, so approval may be the hard stop for a new application.

## Shared tooling requests

The canonical repository currently lacks the historical generic XENEON browser harness and shared runtime described by the older handoff. This product keeps the minimum runtime helpers local, matching the Now Playing migration precedent. Migrate and deduplicate only after clean-runner equivalence is proven.

Current shared XENEON CI and Rat Art/Rat Ship workflows contain Now Playing specific fixture, copy, and invariant assumptions. Generalize them before using the full shared release pipeline for discord-panel. Do not copy those assumptions into this product.

## Network hosts

Live RPC: 127.0.0.1 ports 6463 through 6472.

Avatar images, when Discord supplies an avatar hash: cdn.discordapp.com. The UI has an initials fallback and does not depend on the CDN to remain usable.
