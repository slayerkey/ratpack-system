# Discord RPC approval for PackRat Voice products

## Why approval is needed

PackRat's Discord voice products need local Discord RPC access for:

* `rpc`
* `rpc.voice.read`
* `rpc.voice.write`

Discord's current OAuth documentation marks all three scopes as available only to approved partners. Discord's current RPC documentation also states that unapproved RPC applications are limited to the application's tester list during development and that approval removes that restriction.

Official references:

* https://docs.discord.com/developers/topics/oauth2
* https://docs.discord.com/developers/topics/rpc
* https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service

Discord Developer Support request portal:

* https://support-dev.discord.com/hc/en-us/requests/new

The OAuth documentation says access to approved-partner-only scopes should be discussed with the application's Discord account representative. If PackRat does not have an assigned representative, submit a Developer Support request and ask the team to route the request to the correct RPC or partner review channel.

## PackRat request

Use the PackRat-owned Discord application that will actually ship. Do not submit a temporary or unrelated application ID.

Requested scopes:

```text
rpc
rpc.voice.read
rpc.voice.write
```

Products covered by this request:

```text
PackRat Voice Deck for Elgato Stream Deck
PackRat Voice Panel for CORSAIR XENEON Edge
PackRat Voice Bridge, the free local XENEON companion
```

Voice Deck and Voice Panel are separate paid products for different hardware. Voice Bridge is the free local companion required only by Voice Panel. Voice Deck connects directly to Discord Desktop and does not require Voice Bridge.

## Suggested request text

```text
Hello Discord Developer Support,

I am developing a small family of Windows desktop hardware integrations under the PackRat brand:

PackRat Voice Deck for Elgato Stream Deck
PackRat Voice Panel for CORSAIR XENEON Edge
PackRat Voice Bridge, the free local companion used by Voice Panel

These products connect only to the user's local Discord Desktop client through Discord's documented native RPC/IPC interface. They are focused exclusively on local voice control and voice-room awareness.

We need approval for these RPC scopes:

rpc
rpc.voice.read
rpc.voice.write

The use cases are intentionally narrow:

1. Read the user's currently selected Discord voice channel.
2. Display the current voice roster on the user's local Stream Deck or XENEON Edge hardware.
3. Display live speaking state.
4. Read the user's own local mute and deafen state.
5. Let the user toggle their own local mute and deafen state from their hardware.
6. Follow the user's current voice channel automatically as they switch channels.

The software does not automate messages, scrape Discord, use a Discord user token, operate as a self bot, impersonate a user, or access Discord remotely.

PackRat Voice Deck connects directly from the local Stream Deck plugin process to Discord Desktop. PackRat Voice Panel receives normalized voice state from the local PackRat Voice Bridge over 127.0.0.1. Discord access tokens are not sent to the XENEON widget. Current development builds keep the Discord session access token in process memory only and do not persist it in Stream Deck settings.

We have implemented and tested the transport using Discord's documented RPC commands and voice events and would like approval for a PackRat-owned application before commercial distribution.

Could you please advise on the review and approval process for rpc, rpc.voice.read, and rpc.voice.write, or route this request to the appropriate RPC or partner review team?

Application ID: [PACKRAT APPLICATION ID THAT WILL SHIP]
Application name: [PACKRAT DISCORD APPLICATION NAME]
Product website / marketplace listing: [ADD WHEN AVAILABLE]

Thank you.
```

## Optional StreamKit clarification

Development feasibility was also proven using Discord StreamKit's public RPC identity and public overlay token endpoint. Do not rely on that path for commercial release without explicit written permission from Discord.

Add this question to the support request if useful:

```text
During development we verified the same local voice flow using Discord StreamKit's public RPC client identity and streamkit.discord.com/overlay/token. Is third-party commercial desktop software permitted to authenticate through that public StreamKit identity, or must we receive RPC approval and use our own application identity for production? We will follow whichever production path Discord requires.
```

Treat anything short of explicit written permission as a requirement to use a PackRat-owned approved application.

## After Discord approval

When a PackRat application is approved:

1. Replace the StreamKit development client identity with the approved PackRat application ID where required.
2. Use only Discord's approved production token exchange mechanism for that application.
3. Never embed the application Client Secret in a Stream Deck plugin or XENEON widget.
4. Do not persist Discord access tokens in Stream Deck global settings.
5. If Discord requires a Client Secret or another confidential credential for token exchange, keep that credential in minimal PackRat-controlled server infrastructure and expose only the minimum exchange endpoint needed by the local client.
6. Keep the XENEON widget credential-free and continue passing only normalized local voice state over `127.0.0.1`.
7. Rerun real Windows authorization, channel, roster, speaking, mute, deafen, restart, and packaged-plugin tests for Voice Deck.
8. Rerun Discord Bridge Release QA.
9. Rerun Discord Panel Deep QA.
10. Record the approved application identity, granted scopes, and production exchange architecture in the release documentation.
11. Remove `BLOCKED_EXTERNAL_APPROVAL` only after the approval and required real-host regressions are complete.
12. Only then submit the paid Voice Deck and Voice Panel products publicly.
