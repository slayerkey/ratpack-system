# Discord Voice Panel needs

## Release blockers

1. Replace the placeholder Discord application Client ID after the owner creates the application.
2. Re-probe ports 6463 through 6472 with the real Client ID and Origin null.
3. Prove a safe token acquisition path that does not embed or expose a Discord client secret.
4. Obtain Discord approval for rpc.voice.read and rpc.voice.write before marketplace submission. Current Discord documentation labels WebSocket RPC deprecated and available only to old private beta participants, so approval may be the hard stop for a new application.

## Authentication path to test first

Before introducing a hosted broker, test Discord Public Client plus PKCE with the real application.

Discord's current Social SDK documentation officially supports Public Client applications that exchange an authorization code without a client secret by binding the flow to a PKCE code verifier and challenge. Current official legacy WebSocket RPC documentation still describes AUTHORIZE returning a code, but does not document PKCE fields on that command.

Community Discord protocol documentation reports `code_challenge` and `code_challenge_method: S256` support on RPC AUTHORIZE. Treat that only as a compatibility lead until the real application proves it.

The first real application test should therefore:

1. Enable Public Client in the Discord application's OAuth2 settings.
2. Generate a fresh PKCE verifier and S256 challenge locally in the widget.
3. Attempt RPC AUTHORIZE with only rpc.voice.read and rpc.voice.write plus the PKCE challenge.
4. If Discord returns a code, attempt the public-client token exchange with client_id plus code_verifier and no client secret.
5. Confirm the Discord token endpoint is usable from the XENEON widget's Origin null browser context. If browser CORS blocks the token exchange, do not weaken security.
6. If PKCE is rejected by legacy RPC or the token exchange cannot run safely from the widget, either use a PackRat-controlled server-side exchange broker or stop the product.

No client secret belongs in widget source under any outcome.

## Shared tooling requests

The canonical repository currently lacks the historical generic XENEON browser harness and shared runtime described by the older handoff. This product keeps the minimum runtime helpers local, matching the Now Playing migration precedent. Migrate and deduplicate only after clean-runner equivalence is proven.

Current shared XENEON CI and Rat Art/Rat Ship workflows contain Now Playing specific fixture, copy, and invariant assumptions. Generalize them before using the full shared release pipeline for discord-panel. Do not copy those assumptions into this product.

## Network hosts

Live RPC: 127.0.0.1 ports 6463 through 6472.

Avatar images, when Discord supplies an avatar hash: cdn.discordapp.com. The UI has an initials fallback and does not depend on the CDN to remain usable.

Potential Public Client PKCE token exchange: discord.com. Add this host only if the real application proves the direct browser exchange works.
