# Discord RPC approval for PackRat Voice Panel

## Why approval is needed

The product needs local Discord RPC access for:

- `rpc`
- `rpc.voice.read`
- `rpc.voice.write`

Discord's OAuth documentation marks these scopes as available only to approved partners. Discord's RPC documentation also states that unapproved applications are limited to testers during development and that approval removes that restriction.

Official references:

- https://docs.discord.com/developers/topics/oauth2
- https://docs.discord.com/developers/topics/rpc
- https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service

Discord Developer Support request portal:

- https://support-dev.discord.com/hc/en-us/requests/new

The OAuth documentation says access to approved-partner-only scopes should be discussed with the application's Discord account representative. If PackRat does not have an assigned representative, submit a Developer Support request and ask the team to route the request to the correct RPC/partner review channel.

## PackRat request

Use the PackRat-owned Discord application that will actually ship. Do not submit a temporary or unrelated application ID.

Requested scopes:

```text
rpc
rpc.voice.read
rpc.voice.write
```

Product:

```text
PackRat Voice Panel for CORSAIR XENEON Edge
Free companion: PackRat Voice Bridge for Stream Deck
```

Suggested request text:

```text
Hello Discord Developer Support,

I am building a Windows desktop companion called PackRat Voice Bridge for a CORSAIR XENEON Edge voice panel. The companion connects only to the user's local Discord Desktop client through Discord's documented native RPC/IPC interface.

The product needs these approved RPC scopes:

rpc
rpc.voice.read
rpc.voice.write

The use case is intentionally narrow:

1. Read the user's currently selected Discord voice channel.
2. Display the current voice roster on the user's local XENEON Edge display.
3. Display live speaking state.
4. Read the user's local mute/deafen state.
5. Let the user toggle their own local mute/deafen state from the XENEON Edge.

The app does not automate messages, scrape Discord, use a user token, impersonate a user, or access Discord remotely. Discord access remains local to the user's PC. The XENEON widget receives only normalized local voice state from the companion over 127.0.0.1. Discord access tokens are not sent to the XENEON widget and the current release candidate keeps the session access token in process memory only.

We have implemented and tested the transport using Discord's documented RPC commands/events and would like approval for a PackRat-owned application before commercial distribution.

Could you please advise on the review/approval process for rpc, rpc.voice.read, and rpc.voice.write, or route this request to the appropriate team?

Application ID: [PACKRAT APPLICATION ID THAT WILL SHIP]
Application name: [PACKRAT DISCORD APPLICATION NAME]
Product website / marketplace listing: [ADD WHEN AVAILABLE]

Thank you.
```

## Optional StreamKit clarification

The development feasibility spike also proved that the same functionality works using Discord StreamKit's public RPC identity and its public overlay token endpoint. Do not rely on that for commercial release without explicit written permission.

If useful, add this question to the support request:

```text
During development we verified the voice flow using Discord StreamKit's public RPC client identity and streamkit.discord.com/overlay/token. Is third-party commercial software permitted to authenticate through that public StreamKit identity, or must we receive approval and use our own application identity for production? We will follow whichever production path Discord requires.
```

Treat anything short of explicit permission as a requirement to use a PackRat-owned approved application.

## After Discord approval

When a PackRat application is approved:

1. Replace the StreamKit client identity with the approved PackRat application ID.
2. Use only Discord's approved production token exchange mechanism for that application.
3. Never embed the application Client Secret in the Stream Deck plugin or XENEON widget.
4. Do not persist Discord access tokens in Stream Deck global settings.
5. If Discord requires a Client Secret or another confidential credential for token exchange, keep that credential in PackRat-controlled server infrastructure and expose only the minimum exchange endpoint needed by the companion.
6. Keep the XENEON widget credential-free and continue passing only normalized local voice state over `127.0.0.1`.
7. Rerun the real Windows authorization/channel/roster/speaking/mute/deafen test.
8. Rerun Discord Bridge Release QA.
9. Rerun Discord Panel Deep QA.
10. Update the release docs to record the approved identity and scope grant.
11. Only then submit the paid XENEON product publicly.
