## Context

Capsule today is ~24k lines of TypeScript across `apps/desktop` and seven
workspace packages, with 40 test files. The split is uneven in a way that
decides how this migration should run:

| Area | Lines | Nature |
| --- | --- | --- |
| `packages/config` | ~4.7k | Constants, zod settings schema, placement/snap/severity/corner math |
| `packages/activity` | ~3.4k | Local session reading, JSON-RPC, file watching, token totals |
| `packages/usage` | ~2.5k | HTTP provider adapters, polling, backoff, snapshot merge |
| `packages/dates` | ~0.2k | Reset-time formatters |
| `packages/hud` | ~5.3k | Silhouette path math, meters, cards, springs |
| `packages/ui` | ~0.4k | Settings primitives |
| `apps/desktop` | ~7.6k | Electron main, preload bridge, three renderers |

Roughly 11k lines are pure, host-free logic with tests. Another 5.3k is the
HUD, of which the hardest part — `blob-path.ts`, `corner-path.ts`,
`latch-path.ts`, `path-builder.ts`, about 950 lines — is pure bezier
construction with ~650 lines of tests behind it. Only `apps/desktop` is
genuinely Electron-shaped.

That inverts the usual rewrite risk. The UI is the cheap part: the silhouette
math ports to `CGPath` almost line for line, and CoreGraphics is a better
target for it than SVG. The expensive part is the reader logic — token
discovery, provider response shapes, JSONL session parsing, deduplication,
reset-window arithmetic — because that is where the field bugs were and where
provider drift will keep arriving. Its correctness lives in test files, so the
migration has to move the tests before it moves the code.

Two existing seams help. `packages/activity` already takes its file access
through an injected `ActivityHost` with a `watchDir` hook, so it was built to
be re-hosted. `packages/hud` has no Electron imports at all.

## Goals / Non-Goals

Goals:

- Behavior parity first. A user upgrading should notice lower memory, faster
  launch, better vibrancy, and nothing else.
- Move proven correctness as data. Every ported reader and geometry function is
  accepted by matching fixtures extracted from the current tests, not by
  reading the TypeScript and writing Swift that looks equivalent.
- Keep a shipping app at every phase boundary. The Electron build stays the
  published artifact until the native one passes parity.
- Land the platform win early enough to be worth it, without betting the
  reader logic on it.

Non-Goals:

- Incremental hybridisation of the UI. There is no half-Swift dock; the shell
  and HUD cut over together.
- Preserving the JavaScript toolchain past cutover.
- Matching Electron's renderer pixel output exactly. The acceptance target is
  `hud-reference.jpg`, not the current build's rasterisation.

## Decisions

### 1. Golden fixtures, not a Node sidecar

An earlier sketch of this migration kept `packages/usage` alive as a
spawn-and-exit Node helper so the HTTP readers would not have to be rewritten.
That is rejected. A bundled JavaScript runtime costs 50–90 MB — the entire
download win — and a hardened-runtime app embedding an interpreter needs
JIT or library-validation entitlements, which is new signing friction for a
project that is not yet signed at all.

The readers are also the wrong thing to protect this way. `packages/usage` is
the smallest package; its work is `URLSession` plus `Codable` plus arithmetic,
which is shorter in Swift than in TypeScript. What needs protecting is not the
code but the knowledge encoded in its tests.

So the de-risking mechanism is extraction, not retention: Phase 0 lifts every
test's inline inputs and expected outputs into language-neutral JSON fixtures
that both implementations execute. The TypeScript suite keeps passing against
them while it ships; the Swift suite must pass the identical set before it
replaces anything. The fixtures outlive both.

This is why Phase 0 exists as its own phase and why it is the largest
mechanical task in the change: the current tests hold their data inline, so
there are no fixture files to reuse.

### 2. Logic before shell

Phase 1 ports `config`, `dates`, `usage`, `activity`, and the HUD path math as
Swift modules with no UI and no app target — a library plus a test suite,
runnable under `swift test` headlessly. This front-loads all the real risk into
the phase where iteration is cheapest and nothing is on screen to distract
from correctness.

The shell and HUD rendering (Phase 2) then have nothing left to get wrong
except drawing.

### 3. SwiftPM modules, not Turborepo

Turborepo cannot cache or orchestrate `xcodebuild`; wrapping it in a
`package.json` script would keep the ceremony and lose the benefit. The
monorepo's actual value here is its module boundaries, and SwiftPM expresses
those natively. The package map mirrors today's packages so review can be
done package by package:

| Today | Swift module |
| --- | --- |
| `@capsule/config` | `CapsuleCore` (constants, settings, placement, snap, severity) |
| `@capsule/dates` | `CapsuleCore` (formatters; too small to stand alone) |
| `@capsule/usage` | `CapsuleUsage` |
| `@capsule/activity` | `CapsuleActivity` |
| `@capsule/hud` | `CapsuleHUD` (path math + layer drawing) |
| `@capsule/ui` | folded into `CapsuleSettingsUI` |
| `apps/desktop` | `CapsuleApp` (app target) |

The repo keeps pnpm and Turborepo through Phase 3 because the Electron app is
still shipping from it.

`CapsuleCore` inherits `@capsule/config`'s job as the only place values live:
app name and copy strings, severity bands and colors, HUD geometry and scale
bounds, dock style definitions, placement presets and hints, poll and backoff
intervals, hide delays, provider ids and labels, provider endpoints and
headers, theme ids, and demo snapshots. No other module may hold a literal for
any of these, and no module formats a date except through `CapsuleCore`'s
formatters.

### 4. `NSPanel`, not `NSWindow`

The dock is an `NSPanel` configured as a non-activating floating panel:
`styleMask` including `.nonactivatingPanel`, `isFloatingPanel = true`,
`hidesOnDeactivate = false`, `level` at `.statusBar`, and `collectionBehavior`
of `[.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]`.

That single configuration replaces `overlay-browser-window.ts`,
`overlay-window.ts`, the Spaces handling, and the focus-stealing avoidance, and
it is the reason hover can no longer steal key focus by accident: a
non-activating panel cannot become key by being clicked.

### 5. The hit test moves in-process

Today the renderer measures the dock's opaque regions and ships them to main
over `setHitRegions`, and main runs a cursor poll to decide pass-through
(`overlay-hover.ts`). Both sides can disagree for a frame.

Natively, the layer tree that draws the silhouette is the same object that
answers hit testing: `CAShapeLayer.path.contains(point)` over the current
`CGPath`, inside `NSView.hitTest(_:)`, with `NSTrackingArea` for enter/exit.
There is one source of truth and no IPC. `setHitRegions`,
`setPointerCapture`, `onPointerInside`, and the chrome poll all disappear.

### 6. HUD drawing: ported paths, Core Animation motion

`blob-path.ts`, `corner-path.ts`, `latch-path.ts`, and `path-builder.ts` become
pure Swift functions returning `CGPath`, accepted by the same fixtures as the
current `PathBuilder` output (decision 1 covers how: the fixtures record
canonical path commands, so the comparison is on geometry, not on an SVG
string).

Rendering is a `CAShapeLayer` whose path is that geometry, used as the `mask`
of an `NSVisualEffectView` so the dock gets real window vibrancy behind its
non-rectangular silhouette. Meters become stroked `CAShapeLayer`s animated
through `strokeEnd`.

`use-spring.ts`, `use-animated-number.ts`, `reveal.ts`, and `shadow.ts` are
deleted rather than ported: `CASpringAnimation`, implicit layer animation, and
`NSShadow` cover all four, and the display link that drives them is the
system's.

### 7. Settings in SwiftUI, hosted in AppKit

Settings and onboarding become SwiftUI views in a plain `NSWindow` opened from
the status item and the dock's context menu. The whole renderer stack behind
them — React, TanStack Router, Tailwind, shadcn, zustand, Vite — retires with
`apps/desktop`. Settings is also where native wins presentationally for free:
real `Form` styling, system controls, and automatic appearance handling.

The settings *schema* is not redesigned. It stays the current field set so
carry-over (decision 9) is a format change, not a semantic one.

### 8. Sparkle for updates, with a new signing key

`electron-updater` reads `latest-mac.yml` from GitHub releases;
`scripts/release-notes.mjs` writes the release body that Settings → Updates
shows as "What's new". Sparkle instead reads an `appcast.xml` and **requires**
EdDSA-signed updates, so this phase has a hard prerequisite the current
pipeline does not: generate a Sparkle EdDSA key pair, keep the private key out
of the repository and in CI secrets, publish the public key in `Info.plist`.

The two existing update settings keep their meaning — `autoUpdateCheck` maps to
`SUEnableAutomaticChecks`, `autoUpdateDownload` to
`SUAutomaticallyUpdate` — and the release-notes generator is retargeted from a
Markdown body to an appcast `<description>`.

Capsule's releases are currently unsigned, and macOS already refuses the first
launch. Sparkle's update signing is separate from Developer ID signing and does
not fix that; it only means updates are authenticated once installed.

### 9. Settings carry-over is a one-shot read

`electron-store` leaves schema v7 JSON at
`~/Library/Application Support/Capsule/config.json`. On first launch the native
app reads that file, maps it to its own store, and records that it has done so.
It does not implement the legacy migrations in `packages/config/src/settings.ts`
— `electron-store` already applied those on disk — so a file older than v7, or
one that fails to parse, falls back to defaults and onboarding rather than
guessing.

### 10. Corner arc is dropped, not ported

`CORNER_ARC_ENABLED` is `false`, and `settings.ts` transforms `customCorner` and
`cornerArc` to nothing when it is off. `corner.ts`, `corner-path.ts`,
`CornerFrame.tsx`, and their tests are ~800 lines serving a disabled feature.
They are not ported. Their fixtures are still extracted in Phase 0 so the
decision stays reversible.

### 11. Versions and platform floor

The repo's rule is that every runtime dependency is pinned to a version
published at least seven days earlier. For this change that is:

| Dependency | Constraint |
| --- | --- |
| Swift toolchain | Whatever ships with the Xcode used for release; recorded in `.swift-version` at Phase 1 |
| Deployment target | `macOS 14.0` (see open question 1) |
| Sparkle | Latest 2.x tag published ≥7 days before Phase 3 starts, pinned by exact tag in `Package.swift` |

Exact Sparkle and toolchain versions are deliberately left to be pinned at
implementation time rather than guessed here; Phase 3 task 3.1 records them.
Sparkle is the only third-party runtime dependency in the entire native app.

### 12. Accessibility is explicit now

The DOM gave the dock a partly free accessibility tree. Layer-drawn content
gives none. Each meter, card, and action needs an `NSAccessibilityElement`
role, label, and value, and the dock needs to stay reachable by VoiceOver while
being a non-activating panel. This is new work with no TypeScript counterpart,
and it is a requirement rather than a task so it cannot be quietly skipped.

### 13. Visual iteration without HMR

Losing Vite's hot reload matters most for the dock, which is tuned by eye
against `hud-reference.jpg`. Two things replace it: SwiftUI previews for
settings, and a `capsule-hud-snapshot` test target that renders each dock
style, edge, theme, and open/closed state to PNG. The snapshot set doubles as
the Phase 2 visual acceptance artifact and as regression cover afterwards.

### 14. Tests

`swift-testing` for unit and fixture tests, one suite per module, plus the
snapshot target above. The acceptance rule is the fixture gate from decision 1:
the Swift suite runs the same JSON corpus as the TypeScript suite, and parity
is a count-and-diff, not a judgement.

Heavy runs follow the repo's rule — one target at a time, backgrounded, not the
whole scheme.

### 15. Changelog, not OpenAPI

`CHANGELOG.md` records each phase. v1 remains IPC-free and HTTP-free — the
native app has no local server — so no `openapi.json` appears.

## Risks / Trade-offs

- **Provider drift mid-migration.** An endpoint change during the port means
  fixing it twice. Mitigated by never running two implementations in
  production: the Electron app ships until Phase 3, and the fixture corpus is
  updated once per drift, which both suites then consume.
- **Fixture extraction is tedious and is the gate on everything.** If Phase 0 is
  rushed, the parity claim is hollow and the migration loses its only safety
  property. It is sequenced first and alone for that reason.
- **The HUD may not land as faithful as the current one on the first pass.**
  Accepted: the snapshot target makes the gap visible rather than arguable.
- **Sparkle is a new trust path.** A lost private key means no update channel
  for installed copies. Key handling is a Phase 3 task with an explicit
  non-repo storage requirement.
- **macOS 14 floor drops hardware.** Deliberate, to get modern SwiftUI and safe
  area APIs without compatibility shims; revisit if it bites.
- **Loss of 40 TypeScript test files at Phase 4.** They are deleted only after
  their fixtures are green under Swift, and the fixtures are what is actually
  being preserved.
- **Effort is weeks of evenings, not days.** ~24k lines in, probably 12–16k
  Swift lines out. This is the honest cost and the main argument for not
  starting unless native is wanted for its own sake.

## Migration Plan

Four phases, each ending with the repository in a shippable state.

- **Phase 0 — Fixtures.** Extract inline test data from all 40 test files into
  `fixtures/` as JSON. Re-point the existing Vitest suites at the fixtures and
  confirm they still pass unchanged. No production code moves. The Electron app
  ships throughout.
- **Phase 1 — Logic.** SwiftPM package with `CapsuleCore`, `CapsuleUsage`,
  `CapsuleActivity`, and the `CapsuleHUD` path math. No app target, no UI.
  `swift test` passes the Phase 0 corpus. Electron still ships.
- **Phase 2 — Shell and HUD.** `CapsuleApp` with the `NSPanel` dock, `CGPath`
  rendering over vibrancy, `NSStatusItem`, SwiftUI settings and onboarding, and
  activity notices. Built under a distinct bundle identifier
  (`com.antick.capsule.native`) so it installs beside the released app and the
  two docks can be compared on one screen. Snapshot set reviewed against
  `hud-reference.jpg`. Electron still ships.
- **Phase 3 — Cutover.** Sparkle, EdDSA key, appcast, release-notes retarget,
  settings carry-over, bundle identifier reverts to `com.antick.capsule`. The
  native build becomes the published artifact. The Electron app stays in the
  tree, unshipped, for one release.
- **Phase 4 — Removal.** Delete `apps/desktop`, `packages/*`, pnpm, Turborepo,
  Biome, Vite, Vitest, and the Node scripts. Repo becomes a SwiftPM package
  plus `fixtures/`. Rewrite `openspec/config.yaml`'s stack context and
  `AGENTS.md`'s stack and heavy-command sections.

Rollback: before Phase 3 there is nothing to roll back, since the shipped app
is untouched. After Phase 3, rollback is re-publishing the previous Electron
release and reverting the appcast; the Electron app surviving Phase 3 in-tree
exists to make that possible.

## Open Questions

1. **Deployment target: macOS 14 or 13?** 14 gives the current SwiftUI surface;
   13 keeps 2017 Macs. `NSScreen.safeAreaInsets`, which the notch logic needs,
   is available from 12, so this is about SwiftUI convenience rather than
   capability.
2. **Is the corner arc dead for good?** Decision 10 drops it. If it is meant to
   ship one day, say so and it gets ported in Phase 2 instead of archived as
   fixtures.
3. **Does the provider set stay at five through the port?** Cursor and Copilot
   are off by default today. Porting all five costs more Phase 1 work than
   porting the three default providers and adding the rest after cutover.
4. **Where does the appcast live?** GitHub Pages, the releases branch, or the
   repository's raw content. This decides whether Phase 3 adds a deploy step.
5. **Is a Developer ID signature in scope here?** The README documents the
   unsigned first-launch workaround. Sparkle does not remove it, and a native
   app is a natural moment to fix it, but it is a cost (paid account, CI
   secrets) outside this change as written.
