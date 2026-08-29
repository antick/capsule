# Changelog

All notable changes to Capsule are documented in this file.

## Unreleased

### Added

- OpenSpec planning for the initial Capsule macOS usage dock (`openspec/changes/init-capsule-desktop`): proposal, specs (`usage-dock`, `screen-placement`, `usage-providers`, `desktop-shell`), design, and implementation tasks.
- Reference HUD screenshot at `openspec/changes/init-capsule-desktop/references/hud-reference.jpg`.
- Root `AGENTS.md` requiring agents to auto-commit each completed task (conventional commits, no push).
- pnpm + Turborepo monorepo with `@capsule/config`, `@capsule/dates`, `@capsule/usage`, `@capsule/hud`, `@capsule/ui`, and `@capsule/desktop`.
- Demo-mode usage dock HUD (Claude 73% / ChatGPT 21% / Spark 52%) with connected detail card.
- Electron overlay shell: always-on-top panel, click-through, placement engine, settings window, Claude/ChatGPT adapters.
- Overlay now hydrates usage snapshots on subscribe instead of painting an empty transparent window.
- Overlay uses in-memory routing so Vite's `/overlay/index.html` URL no longer renders TanStack's "Not Found" instead of the dock.
- Overlay paints demo HUD on first frame and stays on the primary display.
- Hover/click to open the usage card with motion; drag the dock and snap it to a screen edge.
- Menu bar extra and Dock icon for Capsule, with Position shortcuts (right, left, bottom, and other placements) plus Open Settings.

### Fixed

- Usage card no longer clips into a distorted rectangle: the overlay stays large enough for the blob, and transparent pixels click through.
- Hover opens a connected speech-bubble card aligned to the active meter; leaving the HUD still closes an unpinned card.
- Drag follows the cursor in the main process so the dock can be moved without losing pointer events, then snaps to the nearest edge.
