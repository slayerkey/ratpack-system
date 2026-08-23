# Discord Voice Panel plan

Status: implementation approved by the owner's instruction to continue until a true manual boundary.

## Product goal

A touch first Discord voice roster for XENEON Edge. The panel should answer three questions at a glance: which voice channel am I in, who is there, and who is speaking. Self mute and self deafen remain reachable without leaving the game.

## Roster composition

The header carries the current channel name, member count, and connected account. The roster is the dominant surface. Every member row contains an avatar when Discord exposes an avatar hash, an initials fallback, display name using nickname first, and explicit mute and deafen glyphs. Speaker state is visually stronger than ordinary presence and speakers move to the top.

Small compositions keep the roster and controls and hide secondary account and activity details. Medium and Large compositions increase row size rather than shrinking copy. XL uses two roster columns and adds a recent speaking activity region.

## Speaking behavior

SPEAKING_START adds a bright ring around the avatar and a subtle row outline and glow. SPEAKING_STOP removes the active animation but keeps the member prioritized for about 900 ms so rapid speech does not cause the roster to constantly jump. Recent activity records speaking starts for the current session only.

Motion uses a short pulse at normal settings. prefers-reduced-motion removes the pulse and leaves a static speaking ring.

## Touch controls

Self mute and self deafen are separate large buttons with icon plus text. Minimum touch target is 72 px on Small, increasing through Medium, Large, and XL. State is not communicated by color alone: the label changes between Mute and Unmute, and Deafen and Undeafen, while the active state also changes fill and icon treatment.

When not authenticated or not in a voice channel, voice controls are disabled instead of pretending a command succeeded.

## Idle and failure states

Authenticated but not in voice: keep the connected account visible and show a calm Not in a voice channel state with a Join a voice channel in Discord hint.

Discord desktop unavailable: show Discord desktop not connected and reconnect automatically.

Client ID missing: show Discord setup required. This is a development blocker, not a customer facing final state.

Authorization not yet possible safely: show Discord authorization required. A Connect Discord action may issue the documented narrow AUTHORIZE request. The resulting authorization code is never displayed, persisted, or exchanged with an embedded client secret.

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

## Privacy and honesty

No message access. No text channel access. No server administration. No bot token. No client secret in widget source. Requested RPC scopes are only rpc.voice.read and rpc.voice.write.

The shipping product cannot be considered ready until a real Discord application Client ID works from Origin null and a safe public client authorization/token path is proven for legacy WebSocket RPC.
