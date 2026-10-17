## Why

Capsule is a permanently visible, macOS-only dock whose job is to report what
other tools consume. Electron is the wrong host for that shape of app.

It is the heaviest process on the machine for the smallest surface: a ~300pt
dock carries a Chromium renderer, a GPU process, and a Node main process, where
comparable Electron apps on a developer Mac sit at 110 MB resident for the main
process alone and several hundred more for the renderer. Native, the same dock
is one process in the tens of megabytes, and the download drops from ~100 MB to
single digits.

Every window behavior Capsule needs is an AppKit primitive Electron only partly
exposes, so the app carries custom code approximating each one: notch
awareness, a non-activating always-on-top panel that joins all Spaces,
per-pixel pointer pass-through driven over IPC, menu-bar presence, and Dock
geometry probing. Natively these are `NSScreen.safeAreaInsets`, an `NSPanel`
collection behavior, an in-process hit test, `NSStatusItem`, and
`NSScreen.visibleFrame`.

The dock's visual target is a glassy silhouette. Real vibrancy behind a custom
non-rectangular shape is a `CAShapeLayer` mask over an `NSVisualEffectView` in
AppKit, and a permanent fight on a transparent Chromium window.

Nothing cross-platform is given up: `electron-builder.yml` ships `mac` targets
only, and Windows and Linux have been out of scope since the initial change.

## What Changes

- Rebuild Capsule as a native Swift/AppKit menu-bar app with identical
  observable behavior: same dock styles, edges, auto-hide latch, themes,
  provider meters, activity notices, token totals, and settings.
- Port the pure logic first, independently of any UI — silhouette path math,
  placement and snapping, severity bands, reset-time formatting, usage response
  mapping, local session parsing — verified against **golden fixtures extracted
  from the existing 40 TypeScript test files**. Correctness transfers by
  fixture, not by re-derivation.
- Replace the drawing stack with `CAShapeLayer` + `CGPath` over an
  `NSVisualEffectView`, and the spring and animated-number helpers with Core
  Animation.
- Replace the overlay window, hit-region IPC, hover tracking, tray icon, and
  Dock/notch probing with `NSPanel`, `NSTrackingArea`, `NSStatusItem`, and
  `NSScreen`. The renderer-to-main hit-region round trip disappears, because
  the hit test runs in the process that owns the window.
- Replace the settings and onboarding renderers with SwiftUI in an ordinary
  `NSWindow`, retiring React, TanStack Router, Tailwind, shadcn, and zustand.
- Replace `electron-updater` with Sparkle, which needs a new EdDSA signing key
  and an `appcast.xml` feed alongside the existing GitHub releases.
- Carry user settings across: the native app reads the schema v7 `config.json`
  that `electron-store` left in Application Support, migrates it once, then
  owns its own store.
- Restructure to a SwiftPM package whose modules mirror today's workspace
  packages, retiring pnpm, Turborepo, Biome, Vite, and Vitest at the final
  phase — not before.
- Drop the corner-arc feature rather than port it; it is ~800 lines of dead
  code behind `CORNER_ARC_ENABLED = false`.

Non-goals: Windows, Linux, or iOS; any change to what Capsule observes or how
it authenticates (endpoints, credential locations, and session formats port
as-is); new dock styles, placements, themes, or providers; teaching Turborepo
to drive `xcodebuild` (it is retired instead); shipping two implementations at
once; sandboxing; Mac App Store distribution.

## Capabilities

### New Capabilities

- `native-shell`: The AppKit application host — process model, settings
  carry-over from the Electron store, Sparkle update delivery, and the
  fixture-parity gate governing when a ported reader may replace its
  TypeScript original.

### Modified Capabilities

- `desktop-shell`: Update delivery moves to Sparkle; pass-through, focus, and
  login-item behavior are restated against AppKit. Other requirements hold.
- `usage-dock`: The dock gains real window vibrancy behind its silhouette, and
  layer-drawn content must carry the accessibility roles the DOM supplied.
- `usage-providers`: Readings are produced in-process by Swift readers with no
  helper or interpreter, and credentials stay inside that one process.

### Unchanged Capabilities

- `screen-placement`: Every requirement holds verbatim. Geometry and snapping
  port as pure functions against the same fixtures; only the source of display
  and Dock geometry changes.

## Impact

- Phases 0–2 add a SwiftPM package at the repo root and leave `apps/desktop`
  and `packages/*` in place and shipping. Phase 3 switches the published
  artifact; Phase 4 deletes the Electron app and the JavaScript toolchain, at
  which point `openspec/config.yaml`'s locked-stack context and `AGENTS.md`'s
  stack sections are rewritten.
- Minimum macOS rises from 11 to 14 (`design.md`, open question 1), dropping
  Macs that cannot run Sonoma.
- Release engineering changes shape: an EdDSA key must be generated and kept
  out of the repository, and the update feed becomes an `appcast.xml` that the
  successor to `scripts/release-notes.mjs` writes.
- No HTTP surface is added, so no `openapi.json` appears.
- Visual acceptance is unchanged:
  `../init-capsule-desktop/references/hud-reference.jpg`.
