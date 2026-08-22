# RatPack System Bootstrap

This is a migration bootstrap, not the finished product factory.

Its purpose is to make RatPack knowledge portable across ChatGPT, Claude Code, Codex, GitHub Actions, and local hardware testing without keeping Claude specific files as the source of truth.

## Intended repository split

`ratpack-system` is the canonical home for shared skills, standards, platform knowledge, test contracts, schemas, and reusable workflow rules.

`ratpack-projects` remains the canonical home for product source, product registry, product research, generated packages, and product specific assets.

The existing local `_shared` repository is load bearing today. Do not move or rename it until its imports are replaced deliberately and tests prove the new layout.

## Start here

Read `RATPACK.md` first.

Then read the matching skill under `skills/` and platform file under `platforms/`.

The full export audit that produced this bootstrap is summarized in `docs/MIGRATION_AUDIT.md`.

## What this bootstrap does not contain

It does not contain credentials, browser login state, font binaries, installed applications, proprietary binaries, the full icon source library, or the 1 GB product factory.

It does not claim that every old command has been fully migrated. Old Claude and Agent definitions are retained under `legacy/` so behavior can be compared before anything is retired.
