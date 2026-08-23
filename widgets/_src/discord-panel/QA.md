# Discord Voice Panel QA

## Build state

Product: Discord Voice Panel

Slug: `discord-panel`

Branch: `product/discord-panel`

Manifest author: `PackRat 🐀`

Version: `0.1.0`

Price target from the product handoff: `$12.99`

Current state: blocked on Discord application access and safe authorization. Not a release candidate.

## Transport probe evidence

PASS from the supplied local probe: Discord desktop on port 6463 accepted a WebSocket upgrade with `Origin: null` and returned HTTP 101. The placeholder Client ID then closed with code 4000 and `Invalid Client ID`, which is expected for the placeholder.

This proves the `Origin: null` transport gate on that Discord installation. The real Client ID still needs a second local probe after the Discord application is created.

## Product behavior implemented

PASS: sequential Discord RPC port discovery from 6463 through 6472.

PASS: narrow `AUTHORIZE` request uses only `rpc.voice.read` and `rpc.voice.write`.

PASS: `AUTHENTICATE` path exists for a valid externally supplied access token. No access token is persisted.

PASS: current selected voice channel retrieval through `GET_SELECTED_VOICE_CHANNEL`.

PASS: subscriptions for `VOICE_CHANNEL_SELECT`, `VOICE_SETTINGS_UPDATE`, `VOICE_STATE_CREATE`, `VOICE_STATE_UPDATE`, `VOICE_STATE_DELETE`, `SPEAKING_START`, and `SPEAKING_STOP`.

PASS: current self mute and deafen state retrieval through `GET_VOICE_SETTINGS`.

PASS: self mute and deafen updates through `SET_VOICE_SETTINGS`.

PASS: speaking users are promoted to the top of the roster. A 900 ms priority hold prevents rapid roster reordering immediately after speech stops.

PASS: mute and deafen are represented by explicit glyphs and state labels, not color alone.

PASS: member tap opens a detail sheet with display name, full username, speaking state, mute state, and deafen state.

PASS: recent speaking activity is session memory only and is never persisted.

PASS: actual Discord avatars are supported when the RPC payload contains an avatar hash, with initials as a reliable fallback.

PASS: setup, disconnected, authorization, exchange-required, voice, and not-in-voice idle states all render deliberately. No state intentionally produces a blank panel.

## Static checks completed in ChatGPT execution environment

PASS: JavaScript syntax through `node --check`.

PASS: generated shipping HTML contains local CSS and JavaScript inline and no module script.

PASS: uppercase `<!DOCTYPE html>`.

PASS: manifest JSON parses and uses `PackRat 🐀`, `com.packrat.discordpanel`, `dashboard_lcd`, and `interactive: true`.

PASS: translation JSON parses.

PASS: 49 settings and runtime translation keys are present in English, German, Spanish, and French.

PASS: no en dash or em dash characters in product source or shipping files.

PASS: no Discord client secret or bot token is embedded in product JavaScript.

Checkpoint note: the self-contained shipping `index.html` was generated and tested locally from the exact authored source, but it is intentionally not committed while the Client ID remains a placeholder. This keeps `widgets/discord-panel/` unpackageable at the blocker checkpoint rather than allowing an incomplete widget to be mistaken for a release candidate. After the real Client ID is inserted, the canonical `tools/xeneon/inline.py discord-panel` build must create the committed shipping `index.html` before CORSAIR validation and packaging.

## Deterministic browser QA

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

## Discord release blockers

BLOCKER: replace `__DISCORD_CLIENT_ID__` with the real Discord application Client ID.

BLOCKER: run the real Client ID local WebSocket probe and confirm the application accepts the widget's `Origin: null` connection.

BLOCKER: Discord's current documentation labels WebSocket RPC deprecated and says it is only available to old participants of the private beta. A newly created application may therefore be unable to use this transport even though the localhost server accepted the placeholder probe.

BLOCKER: `rpc.voice.read` and `rpc.voice.write` are currently documented as approved-partner scopes.

BLOCKER: the documented RPC `AUTHORIZE` command returns an OAuth authorization code, and Discord's documented standard authorization-code token exchange requires a client secret. A client secret must never ship inside a widget. The current product deliberately stops at an `exchange-required` state after a successful `AUTHORIZE` response rather than leaking a secret or pretending authentication is solved.

Potential safe architecture if Discord approves legacy RPC: a PackRat-controlled authorization broker can keep the Discord client secret server-side, exchange the one-time code, and return the short-lived access token to the widget. That would add a hosted dependency and must be explicitly designed and reviewed before implementation.

## CORSAIR and package gates

NOT RUN: official `icuewidget-cli@0.4.47` validation. The package download timed out in the current execution environment.

NOT RUN: official `.icuewidget` packaging because official validation is not yet available here.

NOT RUN: StreamSpell packaged widget verification because there is no official package yet.

The canonical shared XENEON GitHub workflows currently contain Now Playing specific slug, fixture, art, and Rat Ship assumptions. Product boundary rules prohibit changing those shared files in this branch. The required generalization is recorded in `NEEDS.md`.

## Release conclusion

The product UI and deterministic interaction layer are substantially built and pass the eight-layout browser gate. The product must not be sold or submitted yet. The only honest next step is to create the Discord application, obtain its Client ID and partner/RPC access, then prove a safe authentication architecture before the official CORSAIR packaging and independent packaged-widget gates are run.
