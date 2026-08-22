# RatPack System

Canonical hub for Packrat product development.

This repository is the shared source of truth for RatPack skills, platform knowledge, standards, QA contracts, schemas, CI, and cross tool adapters. Product source and large generated media will be consolidated here deliberately as migration proofs pass.

## Start here

Read `RATPACK.md` first.

Then read the matching skill under `skills/` and the matching platform contract under `platforms/`.

## Operating model

ChatGPT is the preferred development and orchestration environment.

GitHub is the canonical filesystem and state store.

GitHub Actions is the remote build and test computer.

Local applications and physical hardware are final validation boundaries, not the normal development environment.

## Migration status

The initial system context is now canonical here. The larger local `ratpack-projects` factory and `_shared` tooling are being absorbed only after clean environment tests prove each dependency can move safely.
