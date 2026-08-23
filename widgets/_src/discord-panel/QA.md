# Discord Voice Panel QA

## Build state

Product: Discord Voice Panel

Slug: `discord-panel`

Branch: `product/discord-panel`

Manifest author: `PackRat 🐀`

Version: `0.1.0`

Price target from the product handoff: `$12.99`

Discord Application ID: `1540927508302536724`

Registered redirect supplied by the owner: `http://127.0.0.1`

Current state: product UI and RPC implementation built, blocked on one real desktop end to end probe plus Discord partner approval. Not a release candidate yet.

## Transport evidence

PASS from the original supplied probe: Discord desktop on port 6463 accepted a WebSocket upgrade with `Origin: null` and returned HTTP 101. The placeholder Client ID then closed with code 4000 and `Invalid Client ID`, which was expected.

The real Application ID is now integrated. The product local `probe.html` tests ports 6463 through 6472 with that real ID from an actual `file://` page, so the next run proves both application lookup and the `Origin: null` RPC Origin configuration.

## Authentication implementation

The temporary authorization blocker has been replaced with a no-secret Public Client PKCE attempt.

PASS by implementation review: fresh 32 byte verifier generated with `crypto.getRandomValues`.

PASS by implementation review: S256 challenge derived with `crypto.subtle.digest`.

PASS by implementation review: RPC `AUTHORIZE` sends the real client ID, `response_type: code`, exact redirect URI, only `rpc.voice.read` and `rpc.voice.write`, and the PKCE challenge.

PASS by implementation review: human authorization gets a two minute RPC timeout rather than the five second data request timeout.

PASS by implementation review: authorization code exchange posts form encoded data to Discord with client ID and code verifier and never sends a Client Secret.

PASS by implementation review: token exchange is bounded by a 12 second abort timeout.

PASS by implementation review: access token is held in memory only for the widget session and reused only for reconnects inside that session.

PASS by implementation review: RPC `AUTHENTICATE` verifies that both voice scopes were actually granted before controls are enabled.

FAIL CLOSED: if Public Client configuration, PKCE compatibility, partner access, or browser CORS prevents token exchange, the panel enters a deliberate token exchange blocked state instead of weakening security.

The product local `probe.html` runs this exact end to end path and finishes by calling authenticated `GET_VOICE_SETTINGS`. A green end to end result is required before packaging.

## Product behavior implemented

PASS: sequential Discord RPC port discovery from 6463 through 6472.

PASS: current selected voice channel retrieval through `GET_SELECTED_VOICE_CHANNEL`.

PASS: subscriptions for `VOICE_CHANNEL_SELECT`, `VOICE_SETTINGS_UPDATE`, `VOICE_STATE_CREATE`, `VOICE_STATE_UPDATE`, `VOICE_STATE_DELETE`, `SPEAKING_START`, and `SPEAKING_STOP`.

PASS: current self mute and deafen state retrieval through `GET_VOICE_SETTINGS`.

PASS: self mute and deafen updates through `SET_VOICE_SETTINGS`.

PASS: speaking users are promoted to the top of the roster. A 900 ms priority hold prevents rapid roster reordering immediately after speech stops.

PASS: mute and deafen are represented by explicit glyphs and state labels, not color alone.

PASS: member tap opens a detail sheet with display name, full username, speaking state, mute state, and deafen state.

PASS: recent speaking activity is session memory only and is never persisted.

PASS: actual Discord avatars are supported when the RPC payload contains an avatar hash, with initials as a reliable fallback.

PASS: setup, disconnected, authorization, authorization failure, token exchange failure, voice, and not-in-voice idle states all render deliberately. No state intentionally produces a blank panel.

## Static checks completed before the real app integration

PASS: JavaScript syntax through `node --check`.

PASS: self-contained generated QA HTML contained local CSS and JavaScript inline and no module script.

PASS: uppercase `<!DOCTYPE html>`.

PASS: manifest JSON parses and uses `PackRat 🐀`, `com.packrat.discordpanel`, `dashboard_lcd`, and `interactive: true`.

PASS: translation JSON parses.

PASS: settings and runtime translation coverage existed in English, German, Spanish, and French.

PASS: no en dash or em dash characters in product source or shipping files.

PASS: no Discord Client Secret or bot token is embedded in product JavaScript.

The real Client ID and PKCE patch only change the live authentication path and related copy. The complete static suite must run again after the live end to end probe passes and before the generated shipping `index.html` is committed.

## Deterministic browser QA completed before the live auth patch

Fixture: 12 voice members, including speaking, self-muted, self-deafened, long names, and descender-heavy text.

PASS: all eight official XENEON viewport compositions reached the voice state with all 12 members represented.

PASS: zero document or body overflow across all eight compositions.

PASS: zero browser runtime exceptions across all eight compositions.

PASS: zero browser console errors across all eight compositions.

PASS: speaker promotion and the 900 ms anti-jitter hold across all eight compositions.

PASS: mute and deafen touch interaction through deterministic fixture hooks across all eight compositions.

PASS: member detail open and close interaction across all eight compositions.

PASS: not-in-voice idle state disables mute and deafen controls and shows a deliberate join-voice hint.

Touch target measurements:

| Slot | Viewport | Minimum mute/deafen target |
| --- | --- | --- |
| S horizontal | 840x344 | 72 px |
| S vertical | 696x416 | 72 px |
| M horizontal | 840x696 | 88 px |
| M vertical | 696x840 | 88 px |
| L horizontal | 1688x696 | 98 px |
| L vertical | 696x1688 | 102 px |
| XL horizontal | 2536x696 | 104 px |
| XL vertical | 696x2536 | 106 px |

Recent activity is intentionally hidden on S, M, and L and visible on both XL compositions. XL roster rendering uses two columns.

## Remaining external release gates

BLOCKER: run `probe.html` from disk on the owner's Windows PC with Discord desktop running. It must report both transport pass and end to end pass.

BLOCKER: Discord currently documents `rpc.voice.read` and `rpc.voice.write` as approved-partner scopes. Marketplace submission must wait for Discord approval even if the owner/tester flow works.

BLOCKER IF PROBE FAILS: if the real application cannot use WebSocket RPC, legacy RPC rejects PKCE, or Discord's token endpoint cannot be read from the widget's `Origin: null`, stop and redesign rather than embedding a Client Secret.

## CORSAIR and package gates

The final shipping `widgets/discord-panel/index.html` is intentionally not committed until the end to end Discord probe passes. This prevents an incomplete integration from looking packageable.

After that pass, run the canonical inline build, structural QA, full eight-layout deterministic browser suite, official CORSAIR CLI validation and package, StreamSpell packaged verification, deterministic Rat Art, and Rat Ship.

The shared XENEON CI, Rat Art, and Rat Ship tooling still contains Now Playing specific assumptions. Product boundary rules prohibit changing shared files in this branch. The required generalization is recorded in `NEEDS.md`.

## Boundary audit

A compare against `main` shows every file changed by this branch is inside either `widgets/_src/discord-panel/` or `widgets/discord-panel/`. No `_shared`, shared inline tool, workflow, registry, or unrelated product file was modified.

## Release conclusion

The product has reached the genuine manual boundary. The next useful evidence is the result of one local `file://` end to end probe using the real Discord application. If it passes, the remaining work is normal XENEON release engineering plus Discord partner approval. If it fails, the log tells us whether the blocker is RPC Origin/application access, PKCE authorization, token exchange CORS, or voice scope approval.
