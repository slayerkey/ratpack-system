# Auto Queue for Claude Code

Keep Claude working without going back to your keyboard.

Auto Queue for Claude Code lets you line up follow-up work from Stream Deck while Claude is already busy. The next request is saved locally and handed to the same Claude Code chat when the current turn finishes.

## What it does

- Queue reusable Claude Code prompts without interrupting the current turn.
- See when Claude is working, finished, waiting for you, or hit an error.
- See the next queued request and how many requests are waiting.
- Remove the next request, move it to the end, or clear the queue from Stream Deck.
- Auto follows the Claude chat you used most recently, with optional per-key chat binding.
- Includes ready-made profiles for Stream Deck, Stream Deck Mini, Stream Deck XL, Stream Deck +, and Stream Deck Neo.

## Ready-made commands

The included profiles arrive with useful starting actions such as Run Tests, Fix Errors, Review Code, Continue, Document, Verify, Plan Next, Summarize, and queue controls. Every Queue Prompt key can be renamed and edited in the Property Inspector.

## Setup

Open Setup from any Auto Queue action and click **Connect Claude Code** once. Auto Queue adds its supported Claude Code hooks while preserving your existing Claude settings and other hooks. Then use Claude Code normally in VS Code or the Claude Code CLI.

Claude Code 2.1.163 or newer is required.

## Local by design

Queued prompts and queue state stay on this computer. Auto Queue does not read or modify Claude credentials, does not upload prompts, and does not require a PackRat account or hosted service.

## Current platform support

Windows 10 or newer. Claude Code in the official VS Code extension and common Windows CLI installations are supported.

Part of the PackRat ecosystem.
