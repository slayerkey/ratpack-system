# XENEON EDGE Ultimate product contract

## Customer problem

A normal XENEON EDGE owner should not have to build a page out of many disconnected widgets or maintain a DIY dashboard just to make the display useful every day.

## v1 architecture

One native XENEON `.icuewidget` with four primary experiences:

- Home
- Performance
- Today
- Ambient

Weather, media, calendar, network and focus are integrated modules, not equal top-level products.

## Native provider contract

Required iCUE providers:

- Sensors 1.0
- FPS 1.0
- Media 1.0

No v1 claim is made for native 1% lows, frametime, album artwork, media progress, seeking, microphone state, per-app volume or true ICMP ping because the documented providers do not expose those values.

## Smart Mode contract

Default full-screen automation is intentionally conservative:

- active FPS session -> Performance
- FPS session ends -> Home, or Today for the Work preset
- user navigation creates a 10 minute manual hold
- Auto button immediately resumes Smart Mode

Media, calendar, network and thermal state change Home's context area without forcibly stealing the whole screen.

## Presets

- Everyday
- Gaming
- Work
- Minimal
- Enthusiast

Presets alter emphasis and default mode without turning the product into a dashboard construction tool.

## Local-first contract

Core clock, sensors, FPS history, media state, focus state, presets and local history require no PackRat server.

Weather calls Open-Meteo directly when latitude/longitude are configured.

Calendar calls the user-provided ICS URL directly and caches the last successful day. Providers that reject local browser access are reported honestly as blocked.

Network timing uses an HTTPS browser probe and is labeled response timing rather than ICMP ping.

## Optional future PackRat Bridge

Only build the companion after the native product is accepted and useful without it.

Possible Bridge responsibilities:

- PresentMon-class frametime / real 1% low telemetry
- album art and media progress
- microphone and app-volume state
- robust ICS transport
- OS-level network metrics

Bridge is enhancement, not a v1 dependency.
