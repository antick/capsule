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
- The dock is redrawn smaller: the rail is a third narrower, the meter rings are smaller and the spacing between them is halved, so 100% is genuinely compact rather than a scaled-down copy of an oversized reference. A preference chosen against the old artwork is dropped rather than carried over, since the percentage no longer means the same thing.
- Dock size moves in 10% steps, three of them either side of the size Capsule ships at, so the range is 70% to 130%. The track between the -/+ buttons is now a slider you can drag or nudge with the arrow keys, and it snaps to the same steps the buttons use.
- The dock travels the full length of the edge it rides. It is measured by the rail you can see rather than the window around it, so it reaches the very bottom of the screen on a side edge and both corners along the top and bottom, instead of stopping short by the width of the card it might have to show.
- The top edge hangs from the physical top of the screen in every dock style. Only the notch used to, so switching style made the dock appear to slip down below the menu bar.
- Styles that float clear of the screen edge now sit a few pixels off it rather than a fifth of an inch, and the bottom edge no longer lines its top up with the macOS Dock's — it sits on the screen edge itself, leaving no band of desktop underneath. Where the Dock is on a side, or hidden, the bottom dock centres on the edge instead of hiding beside icons that are not there.
- Five HUD themes — Midnight, Graphite and Ink for dark desktops, Porcelain and Linen for light ones — plus an Auto option that follows the macOS appearance and swaps between Midnight and Porcelain.
- Three dock styles: Rail (the original, melting into the edge), Capsule (a floating pill) and Tray (a rounded panel with a hairline border, parked just clear of the edge like the macOS Dock). Top-edge notch rendering is reserved for Rail, since the others visibly float.
- On the bottom edge the dock drops its percent captions like the notch already did, so the meters fit the rail's thickness instead of spilling out below it.
- The dock's context menu entry reads "Settings" rather than "Open Settings…".
- On the top edge the dock renders as a notch: compact rings without percent captions, hung from the physical top of the screen over the menu bar.
- Capsule no longer takes a tile in the macOS Dock; it is reached from the menu bar and from the dock itself.
- Settings is rebuilt around a sidebar with a live dock preview, a click-anywhere screen diagram for placement, the size stepper, and provider cards showing connection state and current usage.

### Fixed

- Hovering and clicking the dock work again while another app is in front. macOS only forwards mouse-move events to a click-through window while the owning app is frontmost, so the renderer never learned the cursor had arrived and the dock stayed transparent to it — which also made dragging work only sometimes. The main process now reads the cursor position itself and hit-tests the regions the dock publishes, so nothing depends on which app has focus.
- Capsule no longer starts with a usage card already open: a development-only hook that clicked a meter on launch to grab a screenshot has been removed.
- Settings opens every time, from the menu bar and from the dock's own context menu. Re-opening asked the window that was already up to change its own page and waited for the answer; if that renderer was gone or minimised the answer never came, so the call hung and every later attempt silently did nothing. Nothing waits on the renderer now, a minimised window is restored, and a window whose load failed is thrown away instead of being handed to the next caller.
- The dock's context menu is no longer drawn behind the dock. The overlay outranks pop-up menus, so it now steps down a level for as long as the menu is up.
- The meters stopped shuffling when the dock is moved. Turning a provider back on appended it to the stored list, and since the dock draws them in stored order, the next save re-ordered the rings until the following refresh put them back. The enabled set is kept in one canonical order now.
- The open card no longer loses its left edge on the bottom of the screen. The window was sized without the space the frame reserves for its edge flares, and for a two-row card rather than the tallest one a provider can produce; the frame is pinned to the docked edge, so the surplus hung off the far side and the window clipped it. Both now reserve the same room, and a test walks every edge, style and card size to keep them in step.
- Grok's meter shows the xAI mark. The glyph drawn for it was a lattice of struts that read as Perplexity's logo.
- The band of empty space beside the dock is gone. The window has to be long enough to show a card, which is longer than the rail, and the rail sat in the middle of it — so the dock stopped tens of pixels from each corner with nothing but transparency in between. The rail now slides through that spare room once the window itself has run out of screen, which lets it reach the corner while the card stays where it can still be read.
- A provider that fails to answer is named properly in its card ("Claude", not "claude").
- Turning a provider off in Settings updates the dock immediately instead of waiting out the next round of network calls.
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
