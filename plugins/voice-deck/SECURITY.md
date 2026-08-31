# Voice Deck Security

Voice Deck is deliberately limited to local Discord Desktop voice state.

## Guarantees

* Windows Discord Desktop only
* local Discord RPC / IPC only
* no user-token scraping
* no message automation or self-bot behavior
* no browser scraping
* no remote Discord account control
* no Discord access token passed to the Property Inspector
* no tokens in logs or Marketplace media
* no confidential Discord Client Secret in the plugin
* session access token held in process memory only
* avatar requests are credential-free Discord CDN requests

The Property Inspector receives a sanitized snapshot containing only connection state, channel/member information, voice state, and non-sensitive diagnostics.

## Production identity

The current development feasibility path uses Discord StreamKit's public RPC identity exactly as the existing Voice Bridge does. That path is not treated as permission for commercial distribution. Production remains blocked until Discord explicitly approves the required RPC scopes for a PackRat-owned application or gives written permission for the StreamKit production path.
