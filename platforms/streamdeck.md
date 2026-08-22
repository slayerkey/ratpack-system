# Stream Deck Platform

## Plugins

Canonical development path:

source -> dependency install -> build -> unit and fixture tests -> manifest validation -> Elgato CLI validate -> Elgato CLI package -> artifact -> physical device validation.

The browser workflow can author and update plugin source. GitHub Actions is the preferred clean runner for dependency installation and packaging.

Do not rename published plugin UUIDs.

## Profiles

The existing deterministic Python builder can create standard, XL, Plus, VSD, Windows, and Mac output without the target operating system being present.

VSD means Virtual Stream Deck and is an 8 by 8 product target.

Final import validation remains a Stream Deck application and hardware check.

## Icons

Use approved deterministic icon sources and generators. Existing house rules prefer real icon libraries and prohibit AI generated key icons for the product itself.

Large product media libraries should not be copied into the system repository merely to make context portable.
