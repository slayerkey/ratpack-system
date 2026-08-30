# PackRat Voice Panel plan

Status: implementation approved by the owner's instruction to continue until a true manual boundary.

## Product goal

A touch first Discord voice roster for XENEON Edge. The panel should answer three questions at a glance: which voice channel am I in, who is there, and who is speaking. Self mute and self deafen remain reachable without leaving the game.

The active design automatically follows the user's current Discord voice channel. There is no fixed Server ID or Voice Channel ID setup in the XENEON widget.

## Live architecture

The XENEON widget talks only to the local PackRat Voice Bridge at `ws://127.0.0.1:17483`.

The Stream Deck companion owns Discord native IPC and the current StreamKit public RPC feasibility flow. It sends normalized channel, member, speaking, and self voice state to the widget and receives local authorize, refresh, mute, and deafen commands.

The XENEON package never receives a Discord access token or Client Secret.

## Roster composition

The header carries the current channel name, member count, and connected account. The roster is the dominant surface. Every member row contains an avatar when Discord exposes an avatar hash, an initials fallback, display name using nickname first, and explicit mute and deafen glyphs. Speaker state is visually stronger than ordinary presence and speakers move to the top.

Small compositions keep the roster and controls and hide secondary account and activity details. Medium and Large compositions increase row size rather than shrinking copy. XL uses two roster columns and adds a recent speaking activity region.

## Speaking behavior

SPEAKING_START adds a bright ring around the avatar and a subtle row outline and glow. SPEAKING_STOP removes the active animation but keeps the member prioritized for about 900 ms so rapid speech does not cause the roster to constantly jump. Recent activity records speaking starts for the current widget session only.

Motion uses a short pulse at normal settings. `prefers-reduced-motion` removes the pulse and leaves a static speaking ring.

## Touch controls

Self mute and self deafen are separate large buttons with icon plus text. Minimum touch target is 72 px on Small, increasing through Medium, Large, and XL. State is not communicated by color alone: the label changes between Mute and Unmute, and Deafen and Undeafen, while the active state also changes fill and icon treatment.

When the companion is not authenticated or the user is not in a voice channel, voice controls are disabled instead of pretending a command succeeded.

The widget sends the desired mute/deafen state to the companion. The companion performs the actual Discord RPC `SET_VOICE_SETTINGS` request and publishes the returned state back to XENEON.

## Idle and failure states

Authenticated but not in voice: keep the connected account visible and show a calm Not in a voice channel state with a Join any Discord voice channel hint.

Discord desktop or local bridge unavailable: show PackRat Voice Bridge offline and reconnect automatically.

Authorization required: show a Connect Discord action. Tapping it asks the companion to begin authorization; the XENEON widget does not participate in OAuth or token exchange.

Authorization failure: show a deliberate retry state and keep the detailed transport error on the companion `/state` page rather than exposing credentials or raw auth data on XENEON.

## Eight XENEON compositions

S horizontal 840x344: compact header, single roster column, vertical control rail. Secondary account and activity are hidden.

S vertical 696x416: compact header, single roster column, horizontal controls at the bottom.

M horizontal 840x696: single roomy roster column with vertical controls.

M vertical 696x840: single roomy roster column with horizontal controls at the bottom.

L horizontal 1688x696: wide roster with larger rows and a dedicated right control column.

L vertical 696x1688: tall roster with large rows and bottom controls.

XL horizontal 2536x696: two roster columns, activity rail, and large controls.

XL vertical 696x2536: two compact roster columns, recent activity below, and large bottom controls.

The rule is hide secondary information before shrinking the primary roster or touch targets.

## Privacy and release honesty

No message access. No text channel access. No server administration. No bot token. No Discord Client Secret in the XENEON package or Stream Deck companion.

The current StreamKit public RPC identity is a technical feasibility path, not automatically a commercial release authorization. A release candidate requires both technical proof on the real XENEON Edge and a current terms/policy review for the final Discord identity used by the companion.
