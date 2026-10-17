## 1. Phase 0 — Fixture extraction

The gate for everything else. No production code moves in this phase and the
Electron app keeps shipping from it.

Status: the corpus exists and holds 99 cases — usage, dates, severity, and
token counts. `packages/activity`, most of `packages/config`, `packages/hud`,
and `apps/desktop` are still to extract. All suites pass: dates 15, config 128,
usage 85, activity 39, hud 68, desktop 63.

- [x] 1.1 Create `fixtures/` at the repo root with one directory per capability (`usage/`, `activity/`, `placement/`, `hud-paths/`, `dates/`, `severity/`, `settings/`) and a short `fixtures/README.md` stating that both the TypeScript and Swift suites read it and that neither may keep a private copy of a case.
- [x] 1.2 Agree the fixture file shape before extracting: a JSON object per case with `name`, `input`, `expected`, and an optional `note`, plus a frozen clock value wherever a case depends on "now".
- [x] 1.3 Extract `packages/usage` cases (5 test files): Claude `five_hour`/`seven_day` mapping, Codex, Grok, Cursor, Copilot, clamp bounds, unauthenticated-is-not-zero, stale-on-error merge, backoff and `Retry-After` parsing, poller scheduling.
- [ ] 1.3a Poller scheduling and the provider `fetchSnapshot` wiring stayed inline — they need stubbed hosts. Encode those scenarios as data (stub files, stub responses, expected outcome) so the Swift suite can drive them too, or record in `fixtures/README.md` that they are rewritten natively instead.
- [ ] 1.4 Extract `packages/activity` cases (6 test files): Claude session registry parsing, Codex JSON-RPC connection states, Grok reading, local-events derivation, token totals for today and 30 days, and the regression cases in `activity-regressions.test.ts`.
- [x] 1.5a Extract the `packages/config` severity bands and token-count cases.
- [ ] 1.5b Extract the rest of `packages/config` (8 test files): placement geometry, snapping, motion curves, corner geometry, settings schema migration including the legacy provider and placement renames, and update-state transitions.
- [x] 1.6 Extract `packages/dates` cases: `formatResetRelative` and `formatResetAbsolute` against a frozen clock, including the exact strings in the init spec.
- [ ] 1.7 Extract `packages/hud` path cases (5 test files) as canonical path commands rather than SVG strings, so a `CGPath` can be compared against them: blob silhouette per style and edge, latch geometry, corner geometry, and `path-builder` primitives.
- [x] 1.8a Re-point the extracted suites at `fixtures/` and confirm they pass with no expectation weakened. Done for dates, severity, clamp, backoff, token counts, and provider mapping.
- [ ] 1.8b Re-point every remaining Vitest suite at `fixtures/` and confirm the whole suite still passes with no expectation edited. Any case that cannot be expressed as a fixture stays an inline test and is listed in `fixtures/README.md` as deliberately not portable.
- [x] 1.9 Record the corpus size (cases per capability) in `fixtures/README.md` so Phase 1 parity can be stated as a number.
- [x] 1.10 Update `CHANGELOG.md`.

## 2. Phase 1 — Swift logic modules

No app target and no UI in this phase. Acceptance is the Phase 0 corpus
passing under `swift test`.

- [ ] 2.1 Add `Package.swift` at the repo root declaring `CapsuleCore`, `CapsuleUsage`, `CapsuleActivity`, and `CapsuleHUD` with a `macOS 14.0` platform floor and arm64 as the only architecture, and commit `.swift-version` recording the toolchain. No third-party dependencies in this phase.
- [ ] 2.2 Implement `CapsuleCore` constants and the settings model as the single source of values, mirroring `@capsule/config` — no literals in any other module, per the repo's no-hard-coded-values rule.
- [ ] 2.3 Implement the reset-time formatters in `CapsuleCore`; every other module formats dates only through them.
- [ ] 2.4 Implement severity bands, placement geometry, and snapping in `CapsuleCore`; pass the `placement/` and `severity/` fixtures.
- [ ] 2.5 Implement `CapsuleUsage` snapshot types, clamping, snapshot merge, backoff, and the poller; pass those fixtures.
- [ ] 2.6 Implement all five provider readers in `CapsuleUsage` over `URLSession` and `Codable`, reusing the same local credential locations and the same usage endpoints and headers; pass the `usage/` fixtures.
- [ ] 2.6a Read Claude's keychain credential through the Security framework rather than shelling out to `security`.
- [ ] 2.6b Read Cursor's state database by linking `libsqlite3` directly instead of spawning `sqlite3 -readonly`, so the only remaining subprocess is `gh`.
- [ ] 2.6c Add the one `Process` host helper that `gh auth token` needs, with PATH resolution that finds a Homebrew install, and treat a missing `gh` as "no token" rather than an error.
- [ ] 2.7 Implement `CapsuleActivity` session reading, the Codex JSON-RPC client, token totals, and a file-watching monitor over `FSEvents` behind the same injectable-host seam the TypeScript monitor used; pass the `activity/` fixtures.
- [ ] 2.8 Port the silhouette math into `CapsuleHUD` as pure functions returning `CGPath` — blob, latch, and the `path-builder` primitives — and pass the `hud-paths/` fixtures. Do not port the corner arc (design decision 10); leave its fixtures unexecuted and note that in `fixtures/README.md`.
- [ ] 2.9 Keep every Swift source file at or under 500 lines, splitting as needed.
- [ ] 2.10 Add a parity check that fails if any fixture in the corpus is not executed by the Swift suite, so a silently skipped case cannot pass as green.
- [ ] 2.11 Run `swift test` one target at a time, backgrounded, per the repo's heavy-command rule, and record the case counts against Phase 0's numbers.
- [ ] 2.12 Update `CHANGELOG.md`.

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
