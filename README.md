# Capsule

macOS dock for Claude, Codex, and Grok.

**Account access is disabled.** Capsule does not read account credentials, refresh login tokens, or call provider usage endpoints. Live percentages are unavailable; the dock labels them as disabled. Demo mode uses sample data, and local activity indicators remain available.

**Agent chat is suspended.** Its source code is preserved, but the app does not start its connections, register its commands, show its menu, or build its panel. Old channel setup commands exit without opening a connection. There is no settings or environment override.

## Develop

Requires Node 22+, pnpm 11.22.x, and macOS.

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` starts the Electron overlay. Demo mode is optional and uses fixed sample numbers. Live usage stays disabled regardless of provider or refresh settings.

Right-click the rail for Settings and Quit. Settings cover placement, providers, demo mode, and launch at login.

## Placement

- `right-edge` (default)
- `left-edge`
- `dock-flank-left` / `dock-flank-right`
- `stage-manager-top` / `stage-manager-bottom` (falls back to left-edge when Stage Manager is off)

## Stack

pnpm workspaces + Turborepo, Electron, React, TanStack Router (file-based), Tailwind, Biome. Specs live in `openspec/`.
