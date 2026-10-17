## 1. Phase 0 — Fixture extraction

The gate for everything else. No production code moves in this phase and the
Electron app keeps shipping from it.

Status: extraction is done for everything the native app ports — 987 cases
across 73 files, including stub worlds for each provider's whole read, the
poller, and the activity readers. What remains is `apps/desktop`'s
Electron-main tests (1.8c), which feed the Phase 2 shell. All suites pass:
dates 15, config 492, usage 150, activity 151, hud 339, desktop 63.

- [x] 1.1 Create `fixtures/` at the repo root with one directory per capability (`usage/`, `activity/`, `placement/`, `hud-paths/`, `dates/`, `severity/`, `settings/`) and a short `fixtures/README.md` stating that both the TypeScript and Swift suites read it and that neither may keep a private copy of a case.
- [x] 1.2 Agree the fixture file shape before extracting: a JSON object per case with `name`, `input`, `expected`, and an optional `note`, plus a frozen clock value wherever a case depends on "now".
- [x] 1.3 Extract `packages/usage` cases (5 test files): Claude `five_hour`/`seven_day` mapping, Codex, Grok, Cursor, Copilot, clamp bounds, unauthenticated-is-not-zero, stale-on-error merge, backoff and `Retry-After` parsing, poller scheduling.
- [x] 1.3a Encode the stubbed-host scenarios as data: 53 provider reads against stub worlds recording every request, 15 poller scenarios driven step by step, and 42 activity reader, token scan, scanner and monitor scenarios recording every query and tail read. The inline tests that stubbed hosts by hand are retired.
- [x] 1.4 Extract `packages/activity` cases (6 test files): Claude session registry parsing, Codex JSON-RPC connection states, Grok reading, local-events derivation, token totals for today and 30 days, and the regression cases in `activity-regressions.test.ts`. The suspended agent chat (`claude-channel`, `codex-connection`) is not extracted: it is inactive per `AGENTS.md` and not part of the native app.
- [x] 1.5a Extract the `packages/config` severity bands and token-count cases.
- [x] 1.5b Extract the rest of `packages/config` (8 test files): placement geometry, snapping, motion curves, corner geometry, settings schema migration including the legacy provider and placement renames, and update-state transitions. Pre-v7 migrations are recorded but listed under `wontPort` (decision 9); the corner arc and the spring helpers are not extracted (decisions 10 and 6).
- [x] 1.6 Extract `packages/dates` cases: `formatResetRelative` and `formatResetAbsolute` against a frozen clock, including the exact strings in the init spec.
- [x] 1.7 Extract `packages/hud` path cases (5 test files) as canonical path commands rather than SVG strings, so a `CGPath` can be compared against them: blob silhouette per style and edge, latch geometry, and `path-builder` primitives. The corner arc is not extracted (decision 10), and the React rendering and CSS-only helpers have no values to port.
- [x] 1.8a Re-point the extracted suites at `fixtures/` and confirm they pass with no expectation weakened. Done for dates, severity, clamp, backoff, token counts, and provider mapping.
- [x] 1.8b Re-point the activity, config and HUD suites at `fixtures/`. Inline tests that assert a property stay; tests that only re-asserted a recorded value are removed. Every inline test left either takes an input JSON cannot carry, needs a stubbed host, or asserts a property.
- [ ] 1.8c Extract the portable cases among `apps/desktop`'s 13 test files — overlay placement, Dock and notch probing, the update host. These feed the Phase 2 shell rather than a logic module.
- [x] 1.9 Record the corpus size (cases per capability) in `fixtures/README.md` so Phase 1 parity can be stated as a number.
- [x] 1.10 Update `CHANGELOG.md`.

## 2. Phase 1 — Swift logic modules

No app target and no UI in this phase. Acceptance is the Phase 0 corpus
passing under `swift test`.

Status: Phase 1 is complete. The four logic modules — `CapsuleCore`,
`CapsuleUsage`, `CapsuleHUD`, `CapsuleActivity` — and `CapsuleSystem`, the one
module that touches the machine, all exist, and `swift test` runs 107 tests.
932 of the corpus's 987 cases pass in Swift; the rest are the update wording
deferred to Sparkle (2.2e, 43 cases) and the pre-v7 settings migrations the
native app deliberately does not run (`wontPort`, 12 cases).

- [x] 2.1 Add `Package.swift` at the repo root with a `macOS 14.0` platform floor, and commit `.swift-version` recording the toolchain. No third-party dependencies in this phase. Declares `CapsuleCore` and the `CapsuleFixtures` test-support target; `CapsuleUsage`, `CapsuleActivity` and `CapsuleHUD` are declared as their content lands, because an empty module would claim progress that does not exist.
- [x] 2.1a Add a Swift corpus loader that finds `fixtures/` by walking up to `pnpm-workspace.yaml`, the same way the TypeScript loader does, so neither side keeps a copy inside its own target. Ignore `.build/` and `.swiftpm/`.
- [x] 2.1b Add a coverage gate that fails when a fixture exists that no Swift test reads and no one has listed as not-yet-ported.
- [x] 2.2a Implement the `CapsuleCore` severity bands as the single source of those numbers.
- [x] 2.2b Implement `CapsuleCore`'s HUD metrics, dock styles, placement constants and the settings model, mirroring `@capsule/config`; pass `hud-metrics/`, `settings/defaults` and `settings/parse-current`. The fifty authored HUD sizes live in one key-path table.
- [x] 2.2c Read only schema v7 settings files, returning nil for older or unversioned ones so the app falls back to defaults and onboarding (decision 9). Pinned by native tests, since the corpus records the Electron behaviour instead.
- [x] 2.2d Port session summary and ordering into `CapsuleCore`, since both `CapsuleActivity` and `CapsuleHUD` depend on them; pass `activity/summarize`, `activity/order-sessions` and `activity/any-active`.
- [ ] 2.2e Port the update wording and sizes with the Sparkle work in Phase 3; their fixtures (`updates/`) stay in `notYetPorted` until then.
- [x] 2.3 Implement the reset-time formatters in `CapsuleCore`; every other module formats dates only through them. Includes `formatElapsed`, `formatAgo`, `dayKey`, `startOfDay` and `formatCompactCount`, and normalises the meridiem space so copy cannot drift with the toolchain.
- [x] 2.4 Implement placement geometry and snapping in `CapsuleCore`; pass the `placement/` fixtures. Every `Math.round` goes through `jsRound`, and edge snapping keeps the original's left, right, top, bottom tie-break.
- [x] 2.5a Implement the snapshot types, clamping, snapshot merge, and backoff in `CapsuleUsage`; pass those fixtures.
- [x] 2.5b Implement the poller as an actor and pass `usage/poller`. Timers, wake and network become `tick()`, `resume()` and `online()` for the shell. The follow-up refresh uses the corrected rule, so nothing enabled no longer loops.
- [x] 2.6a Implement all five providers' payload mapping and token reading in `CapsuleUsage` over `Codable`; pass every `usage/` fixture with whole-snapshot equality.
- [x] 2.6b Implement the five providers' reads and pass `usage/provider-reads`, outcome and requests both. Responses decode leniently, as the original's do.
- [x] 2.6c Read Claude's keychain credential through the Security framework rather than shelling out to `security`.
- [x] 2.6d Read Cursor's state database, and Codex's stores, by linking `libsqlite3` directly instead of spawning `sqlite3 -readonly`, so the only remaining subprocess is `gh`.
- [x] 2.6e Add the one `Process` host helper that `gh auth token` needs, with PATH resolution that finds a Homebrew install and the original's 8-second timeout, and treat a missing `gh` as "no token" rather than an error.
- [x] 2.7a Implement `CapsuleActivity`'s pure logic — Claude registry parsing, the Codex activity hint, local event evidence, the notice tracker and token counting — and pass every `activity/` fixture.
- [x] 2.7b Implement the activity readers, token scanner and monitor behind an injectable host and pass every `activity/` reader scenario; watch the Claude sessions directory with `FSEvents`, which also sees a file rewritten in place.
- [x] 2.7c Add `CapsuleSystem` with the real macOS hosts — files, the guarded tail reader, processes via `sysctl`, SQLite, the keychain, commands, the directory watcher and a JSON store — tested offline against temp directories.
- The Codex JSON-RPC client is not ported: it serves the suspended agent chat, which is not part of the native app.
- [x] 2.8 Port the silhouette math into `CapsuleHUD` — path builder, blob layout, rail and bubble outlines, frame padding, hit regions, the latch and its fold — and pass all eight `hud-paths/` fixtures with exact equality. The corner arc is not ported (design decision 10).
- [x] 2.8a Convert outlines to `CGPath` for the shape layers (design decision 6), checked natively by bounding boxes and point containment, since the corpus checks commands rather than shapes.
- [x] 2.9 Keep every Swift source file at or under 500 lines, splitting as needed. Largest is `Providers/Grok.swift` at 216.
- [x] 2.10 Add a parity check that fails if any fixture in the corpus is not executed by the Swift suite, so a silently skipped case cannot pass as green.
- [x] 2.11 Run `swift test` one target at a time, backgrounded, per the repo's heavy-command rule, and record the case counts against Phase 0's numbers: 822 of 877 cases ported, the remainder accounted for in the status above.
- [x] 2.12 Update `CHANGELOG.md`.

## 3. Phase 2 — Native shell and dock

Built under bundle identifier `com.antick.capsule.native` so it installs beside
the released Electron app for side-by-side comparison. Electron still ships.

- [ ] 3.1 Add the `CapsuleApp` target as an `LSUIElement` accessory app with no Dock tile and no window on launch.
- [ ] 3.2 Implement the dock as a non-activating floating `NSPanel` at status-bar level with `canJoinAllSpaces`, `stationary`, `ignoresCycle`, and `fullScreenNone`, and confirm it never becomes the key window on hover, click, pin, or drag.
- [ ] 3.3 Draw the dock as a `CAShapeLayer` path from `CapsuleHUD` used as the mask of an `NSVisualEffectView`, and honour Reduce Transparency by falling back to an opaque surface.
- [ ] 3.4 Implement hit testing against the live path inside `hitTest(_:)` with `NSTrackingArea` for enter and leave, and verify pass-through inside a Rail style's concave fillet and mid-unroll.
- [ ] 3.5 Implement meters as stroked layers animated through `strokeEnd`, and card open/close with `CASpringAnimation`. Do not port the spring, animated-number, reveal, or shadow helpers.
- [ ] 3.6 Implement hover-open, pointer-move-onto-card, leave-close, and click pin/unpin with the existing delays from `CapsuleCore`.
- [ ] 3.7 Implement the auto-hide latch and its hide delays, and drag-to-move with edge snapping.
- [ ] 3.8 Implement display and Dock geometry from `NSScreen.visibleFrame` and notch awareness from `NSScreen.safeAreaInsets`, replacing the chrome poll, and recompute placement on display reconfiguration.
- [ ] 3.9 Implement the `NSStatusItem` menu-bar item and the dock's context menu, including Settings and Quit.
- [ ] 3.10 Implement unauthenticated, stale, and error meter and card states so an unauthenticated provider never reads as `0% Used`.
- [ ] 3.11 Implement activity notices as passive, non-blocking surfaces that do not take focus and do not displace usage as the dock's primary content.
- [ ] 3.12 Build settings and onboarding in SwiftUI in an ordinary `NSWindow`, covering placement, dock style, theme, scale, providers, auto-hide and delay, refresh interval, launch at login via the system login-item service, notification popups, and the updates pane.
- [ ] 3.13 Add accessibility roles, labels, and values for every meter, card, and card action, and verify the dock is reachable by VoiceOver despite never taking key focus.
- [ ] 3.14 Add the `capsule-hud-snapshot` test target rendering every dock style, edge, theme, and card state to PNG.
- [ ] 3.15 Compare the default right-edge three-meter Claude-card-open snapshot against `../init-capsule-desktop/references/hud-reference.jpg` and record the result; close the gaps before the phase is called done.
- [ ] 3.16 Measure resident memory and cold launch of the native build against the Electron build on the same machine and record both in `CHANGELOG.md`, so the premise of this change is checked rather than assumed.
- [ ] 3.17 Update `CHANGELOG.md`.

## 4. Phase 3 — Cutover

- [ ] 4.1 Generate a Sparkle EdDSA key pair. Store the private key in release credentials only; confirm it is absent from the repository and from the built bundle. Put the public key in `Info.plist`.
- [ ] 4.2 Add Sparkle to `Package.swift`, pinned to an exact 2.x tag published at least seven days earlier, and record the version in `design.md`'s version table.
- [ ] 4.3 Wire `autoUpdateCheck` to automatic checks and `autoUpdateDownload` to automatic download, keeping both defaults as they are today.
- [ ] 4.4 Replace `scripts/release-notes.mjs`'s output path with an appcast `<description>`, and resolve open question 2 by choosing where `appcast.xml` is published.
- [ ] 4.5 Verify the update path end to end: a newer signed entry is offered with its notes, an entry with a bad signature is refused, an unreachable feed reports a failed check while the dock keeps showing usage, and an up-to-date install says so.
- [ ] 4.6 Implement the one-shot settings carry-over from the schema v7 `config.json` in Application Support, including the fallback to defaults and onboarding for a missing, corrupt, or pre-v7 file, and the recording that migration has happened.
- [ ] 4.7 Revert the bundle identifier to `com.antick.capsule`, build a signed and notarized `arm64` `dmg` — no x64 slice — and confirm an installed Electron copy upgrades in place with its settings intact.
- [ ] 4.8 Publish the native build as the release artifact. Leave `apps/desktop` in the tree, unshipped, for one release as the rollback path.
- [ ] 4.9 Update `CHANGELOG.md`, and rewrite the README's install section: it currently tells people to "pick the `arm64` build for Apple silicon and the `x64` build for Intel Macs". Say plainly that the native app needs an Apple Silicon Mac on macOS 14 or newer, and that Intel Macs stay on the final Electron release.

## 5. Phase 4 — Removal

- [ ] 5.1 Confirm one release has shipped natively with no rollback, then delete `apps/desktop` and `packages/*`.
- [ ] 5.2 Delete `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, the root `package.json`, `pnpm-lock.yaml`, and the Node scripts, keeping `fixtures/` and any script still used by the Swift release pipeline.
- [ ] 5.3 Rewrite `openspec/config.yaml`'s stack context block for the Swift app, replacing the Electron stack that was locked for `init-capsule-desktop`.
- [ ] 5.4 Rewrite `AGENTS.md`'s Stack, Conventions, and heavy-command sections for a SwiftPM project, keeping the auto-commit, no-hard-coded-values, shared-date-formatter, 500-line, and changelog rules.
- [ ] 5.5 Re-point the TypeScript-only fixture notes in `fixtures/README.md` now that only the Swift suite consumes the corpus.
- [ ] 5.6 Update `CHANGELOG.md`.
