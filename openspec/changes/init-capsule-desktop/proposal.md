## Why

Claude, ChatGPT, and other AI subscriptions enforce rolling session and weekly usage limits, but macOS has no persistent, glanceable place to see remaining quota. Capsule occupies the empty gutters that already exist on a Mac — the unused left and right of a centered Dock, the leftover top and bottom of Stage Manager’s window strip, and the screen edges — with a dark circular-meter rail that matches the reference HUD, so remaining usage is visible without switching apps.

## What Changes

- Introduce **Capsule**, a macOS desktop app whose primary surface is an always-on-top, frameless usage dock matching `references/hud-reference.jpg`.
- Show one circular meter per enabled AI provider (Claude, ChatGPT, and a third slot in v1) with a live percent and a severity-colored ring.
- On hover (and when pinned by click), morph a connected speech-bubble card out of the rail that shows the provider name, two usage buckets with progress bars, percent used, and reset copy.
- Let the user place the rail on the **right edge** (default, as in the reference), the **left edge**, **Dock-adjacent** (left or right of the macOS Dock in the empty flanks), or in the **Stage Manager gutter** (above or below the left-side window thumbnails).
- Fetch live usage through provider adapters that reuse existing local credentials where possible (Claude Code / Anthropic OAuth, ChatGPT/Codex auth), with a demo provider so the three-ring HUD can be developed without credentials.
- Add a Settings / onboarding window (React + TanStack file-based router, Tailwind, shadcn) for placement, enabled providers, auth status, launch-at-login, and refresh interval.
- Scaffold this repository as a **pnpm + Turborepo** monorepo with Electron + Node.js (main), React (renderer), Biome for lint/format, and a shared config package. Existing slashism.com markdown posts stay in place; they are not part of Capsule.

Non-goals for this change:

- Windows, Linux, iOS, or a menu-bar-only extra as the primary UI.
- Building or wrapping the AI products themselves (no chat, no prompts).
- A public HTTP API (v1 is local Electron IPC; no `openapi.json` until an HTTP surface exists).
- Deleting or migrating the existing blog markdown files in this repo.
- Pixel-perfect recreation of macOS Dock or Stage Manager themselves — Capsule only sits in leftover space.

## Capabilities

### New Capabilities

- `usage-dock`: Collapsed rail of circular meters, connected speech-bubble detail card, severity colors, and HUD interaction (hover, pin, leave).
- `screen-placement`: Placement presets and a geometry engine that keeps the rail in unused gutters (screen edge, Dock flanks, Stage Manager leftover space) across display and OS-chrome changes.
- `usage-providers`: Provider adapters, usage buckets (session vs all-models), polling, auth/error/empty states, and shared reset-time formatting.
- `desktop-shell`: Electron overlay window lifecycle, click-through, always-on-top, workspaces, launch-at-login, settings/onboarding, persistence.

### Modified Capabilities

- None (greenfield; `openspec/specs/` has no existing capabilities).

## Impact

- This change is the initial Capsule product. Implementation will add `apps/desktop` and `packages/*` at the repo root, plus root tooling (`pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `CHANGELOG.md`).
- New runtime: Electron main process, a transparent overlay renderer, and a separate settings renderer route.
- External systems: Anthropic OAuth usage (`five_hour`, `seven_day`), ChatGPT/Codex local auth, optional third-provider adapter, macOS Dock and Stage Manager layout signals.
- No production HTTP API in v1; renderer talks to main via a typed preload bridge.
- Visual acceptance is against `references/hud-reference.jpg` (right-edge placement, three meters, Claude card expanded).
