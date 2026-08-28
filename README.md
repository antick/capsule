# Capsule

macOS usage dock for Claude, ChatGPT, and a third Spark slot. It sits in leftover screen chrome — display edges, empty Dock flanks, and Stage Manager gutters — and matches the black circular-meter HUD in the OpenSpec reference.

## Develop

Requires Node 22+, pnpm 11.22.x, and macOS.

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` starts the Electron overlay. Demo mode is on by default so the three-meter right-edge HUD appears without live credentials.

Right-click the rail for Settings and Quit. Settings cover placement, providers, demo mode, poll interval, and launch at login.

## Placement

- `right-edge` (default)
- `left-edge`
- `dock-flank-left` / `dock-flank-right`
- `stage-manager-top` / `stage-manager-bottom` (falls back to left-edge when Stage Manager is off)

## Stack

pnpm workspaces + Turborepo, Electron, React, TanStack Router (file-based), Tailwind, Biome. Specs live in `openspec/`.
