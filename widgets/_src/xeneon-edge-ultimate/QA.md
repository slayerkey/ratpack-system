# XENEON EDGE Ultimate QA

## Current build state

Implementation-complete native-first release candidate source.

Version remains `0.9.0` until the official iCUE package/host/StreamSpell gate is green.

## Static gates

- Source head is XML-safe after RatPack inlining.
- Authored JavaScript passes `node --check`.
- No remote JavaScript or stylesheet dependencies.
- Custom Style triplet is `textColor`, `accentColor`, `backgroundColor` in canonical order.
- Required plugin declarations match documented iCUE provider module/plugin/version strings.
- No code or copy claims native 1% lows, frametime, album art, media progress, ICMP ping or literal packet loss.
- Browser HTTPS network timing is named honestly.
- Weather and calendar fail closed when configuration/network access is unavailable.
- Preview fixtures are gated by `iCUE.isPreview` and never used as shipping telemetry.

## Eight-slot layout contract

Deliberate rules exist for:

- 840x344 S horizontal
- 696x416 S vertical
- 840x696 M horizontal
- 696x840 M vertical
- 1688x696 L horizontal
- 696x1688 L vertical
- 2536x696 XL horizontal
- 696x2536 XL vertical

Small and medium layouts intentionally remove secondary rails instead of shrinking all information into unreadable cards.

## Runtime states to verify in official harness

### Sensors

- provider absent
- catalog empty
- CPU/GPU auto-discovery
- partial sensor availability
- hot threshold state
- live setting color changes

### FPS

- unavailable
- desktop 0 FPS
- game active
- process changes
- Smart Mode enter
- Smart Mode exit
- 10 minute manual hold
- Auto resume

### Media

- provider absent
- nothing playing
- track + artist
- previous / play-pause / next

### Weather

- no location
- valid location
- network failure
- cached result
- unit switch

### Calendar

- no URL
- valid direct ICS
- recurring DAILY
- recurring WEEKLY / BYDAY
- all-day event
- blocked/CORS feed
- cached day

### Network

- successful HTTPS response timing
- slow response
- repeated failures
- recovery

### Focus

- start
- pause
- reset
- persisted active timer
- timer completion

## Release gate still required

Run canonical RatPack XENEON gate on the exact package:

1. `python tools/xeneon/inline.py xeneon-edge-ultimate`
2. `python tools/xeneon/inline.py xeneon-edge-ultimate --check`
3. official `icuewidget-cli@0.4.47 validate`
4. official package creation + ZIP integrity
5. lexical iCUE Custom Style smoke
6. Corsair Labs Windows host smoke
7. StreamSpell eight-preset packaged render
8. deterministic Rat Art
9. visual review at native 2536x696 and 1688x696

Do not mark 1.0.0 or Marketplace-ready until these pass.
