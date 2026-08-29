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
- Live Claude, Codex, and Grok usage from local CLI logins (`~/.claude`, `~/.codex`, `~/.grok`). Demo mode is now opt-in.

### Changed

- The dock rides one of four screen edges, and dragging it re-docks to whichever edge the cursor is nearest — the layout, tail direction and slide axis all follow. The Dock-flank and Stage Manager presets are gone; stored settings fold onto the edge they sat on.
- Every dimension of the dock is derived from a single size preference, adjustable from 55% to 120% with the -/+ stepper in Settings. It now ships smaller by default, with tighter spacing between the meter rings.
- On the top edge the dock renders as a notch: compact rings without percent captions, hung from the physical top of the screen over the menu bar.
- On the bottom edge the dock sits level with the macOS Dock rather than floating above it, and parks in the free space beside its icons.
- Settings is rebuilt around a sidebar with a live dock preview, a click-anywhere screen diagram for placement, the size stepper, and provider cards showing connection state and current usage.

### Fixed

- Dragging no longer dies part-way. Pointer capture is taken on the dock root instead of whichever child was pressed, so it survives the re-renders a drag causes; click-through stays off for the whole press rather than only after the drag threshold; and a missed pointer release is caught at the window so the dock cannot get stuck mid-drag.
- The usage card stays landscape on every edge. It used to be rotated with the frame on the top and bottom edges, which turned it into an unreadable vertical strip — the reason moving the dock from the menu bar looked broken.
- Tailwind now scans `@capsule/ui`, so the shared switch renders as a switch instead of a zero-height sliver.
- HUD geometry now traces the reference pixel for pixel: the rail is a 95px flush strip with concave edge flares and rounded inner corners, drawn separately from the 307x185 card so the pointed tail can float 16px clear of the rail.
- Meter and card typography match the reference measurements: 58px rings with a 6px stroke, 24px provider marks, a 17px card title, and 12px body labels.
- Claude's sunburst is drawn as tapered spokes rather than uniform strokes, so it reads as the Anthropic mark at 24px.
- Meters keep a fixed size when their card opens; the active one is marked by the tail and a subtle opacity shift rather than a scale-up the reference does not have.
- Claude no longer reports week-old numbers as current: a `~/.claude.json` cache whose windows have already rolled over is rejected, and both the Keychain and the credentials file are tried before giving up.
- Grok no longer lists the same percentage twice when xAI echoes the headline credit usage back as a product row.
- Dragging the dock is locked to the edge it is docked to, so a right-edge dock slides vertically and keeps its position instead of re-snapping.

- HUD silhouette now matches the reference: a flush square outer rail, inner bite, and a pointed speech-bubble tail instead of a peanut-waist goo blob.
- The card tail is a single solid path so the rail bite is no longer a see-through hole.
- Overlay preload now externalizes `electron`, so the HUD actually receives live snapshots instead of staying on Not connected.
- Codex and Grok meters read live CLI usage via Node fetch (Chromium fetch was dropping auth); Claude falls back to `~/.claude.json` when the OAuth usage API rate-limits instead of showing Not connected.
- Migrated settings are saved so demo mode and legacy ChatGPT/Spark provider ids do not stay stuck on disk.
- The dock no longer renders as an empty black pill while usage is loading or a provider is signed out; meters stay visible with empty rings until live data arrives.
- Usage card no longer clips into a distorted rectangle: the overlay stays large enough for the blob, and transparent pixels click through.
- Hover opens a connected speech-bubble card aligned to the active meter; leaving the HUD still closes an unpinned card.
- Drag follows the cursor in the main process so the dock can be moved without losing pointer events, then snaps to the nearest edge.
