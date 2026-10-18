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
- [x] 1.8c Superseded: the Electron main process's placement, Dock and notch probing and update host were rewritten natively and are covered by `CapsuleShellTests` (placement, interaction, carry-over) and the update fixtures, rather than extracted.
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
- [x] 2.2e Port the update wording, sizes, release notes and release URL into `CapsuleCore`; all six `updates/` fixtures pass, and `notYetPorted` is empty.
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

Status: Phase 2 is complete. The dock, its card and notices, the menus, the
settings window and onboarding are native, checked by behaviour, interaction
and snapshot tests. A pass with VoiceOver itself is still to do by hand.

- [x] 3.1 Add the `CapsuleApp` target as an `LSUIElement` accessory app with no Dock tile and no window on launch. `scripts/bundle-macos.sh` wraps the SwiftPM executable in `Capsule.app` with `Support/CapsuleApp/Info.plist`, stamps the workspace version, and signs it ad hoc.
- [x] 3.1a Drive the logic modules on the real hosts from the Mac's own events, in `CapsuleShell`: the poller ticks on the settings' interval, resumes on wake, and reads again on screen unlock (the original's "online") and when the network path returns; the activity monitor rescans on its 2-second poll and on FSEvents in the Claude sessions directory; the token scanner rescans every minute. Unit-tested against fake event sources, and run live once.
- [x] 3.1b Read the native app's own schema v7 settings from its own Application Support folder, named after the side-by-side identifier, falling back to defaults; nothing is shared with the Electron app's files.
- [x] 3.2 Implement the dock as a non-activating floating `NSPanel` at status-bar level with `canJoinAllSpaces`, `stationary`, `ignoresCycle`, and `fullScreenNone`, and confirm it never becomes the key window on hover, click, pin, or drag — asserted by the interaction tests, which drive the real panel with synthetic events.
- [x] 3.3 Draw the dock as a `CAShapeLayer` path from `CapsuleHUD`, the rail and the card's bubble as one silhouette under two shadows (contact and ambient), in the theme's surface. The vibrancy layer first drafted under it is dropped: the reference surface is opaque, so vibrancy could never show, and Reduce Transparency is honoured by construction.
- [x] 3.4 Hit-test against the regions the frame layout computes for the settled shape — the rail alone, rail-tail-card while open, the latch zone while folded — so a Rail style's concave fillets and anything outside the dock pass clicks through. The pointer is followed with global and local event monitors, not the Electron app's 24 ms cursor poll, and the panel takes the mouse only over those regions or for a press or drag in progress.
- [x] 3.5 Implement meters as stroked layers whose `strokeEnd` springs to the reading, with the refresh sweep, the press, the activity arc and the unread pulse as Core Animation; the fold, the tail's glide, the card's height and its reveal are springs stepped on the display link, because the outline has to be traced again as it changes. The JavaScript spring, animated-number, reveal and shadow helpers are not ported.
- [x] 3.6 Implement hover-open, pointer-onto-card, leave-close, and click pin/unpin with the delays from `CapsuleCore`, as `DockBehavior`, tested against a hand-driven clock.
- [x] 3.7 Implement the auto-hide latch and its hide delays, Show Dock's hold, Keep open, and drag-to-move with edge snapping, re-docking to the nearest edge and display mid-drag and saving the rail's position on drop.
- [x] 3.8 Implement display and Dock geometry from `NSScreen.visibleFrame` and the Dock's own preferences, notch awareness from `safeAreaInsets` and the auxiliary top areas (with `CAPSULE_FAKE_NOTCH` for trying it on a Mac without one), and recompute placement on display reconfiguration, wake and appearance changes instead of polling.
- [x] 3.9 Implement the `NSStatusItem` menu-bar item and the dock's context menu — Show Dock, Keep open, Settings, Position, the update item, Quit — rebuilt each time they open, plus the application menu with its shortcuts while settings is in front.
- [x] 3.10 Implement unauthenticated, stale, refreshing and error meter and card states; an unauthenticated provider reads as a dash and "Not connected", never `0% Used`.
- [x] 3.11 Implement activity notices: the tracker's notices pop up as the card for their provider, time out unless hovered, are read after a second under the pointer, and leave an unread badge and a pulsing mark when popups are off.
- [x] 3.12 Build settings and onboarding in SwiftUI in an ordinary `NSWindow`: Appearance (live preview, style, theme, size, placement, behaviour), Providers, Updates, General and Onboarding, with launch at login through `SMAppService`. Updates check GitHub's latest release and send the user to its page; installing in place waits for Sparkle (Phase 3).
- [x] 3.13 Add accessibility roles, labels, and values: each meter is a button labelled with its provider and reading, the notice badge a button labelled with its count, and the card's controls carry SwiftUI labels. Checked through the accessibility tree in the interaction tests; a pass with VoiceOver itself is still to do by hand.
- [x] 3.14 Add the `CapsuleSnapshotTests` target, rendering every dock style and edge in two themes and every card state in all five themes to PNG under `.build/snapshots`.
- [x] 3.15 Compared the default right-edge three-meter Claude-card-open snapshot against the reference: silhouette, ring colours and direction, card rows and copy match. The differences — tighter meter spacing, the concave tail, the current Grok mark — are the Electron app's own later design, which the native app follows.
- [x] 3.16 Measured on the same Mac, both in demo mode with update checks off, caches warm: Electron shows its dock 0.61–0.66 s after launch and holds 551 MB resident across 4 processes; the native app shows its dock in 0.24–0.25 s and settles at a 58 MB footprint in one process (156–169 MB resident before the first token scan hands its parsing memory back).
- [x] 3.17 Update `CHANGELOG.md`.

## 4. Phase 3 — Cutover

- [ ] 4.1 Generate a Sparkle EdDSA key pair. Store the private key in release credentials only; confirm it is absent from the repository and from the built bundle. Put the public key in `Info.plist`.
- [ ] 4.2 Add Sparkle to `Package.swift`, pinned to an exact 2.x tag published at least seven days earlier, and record the version in `design.md`'s version table.
- [ ] 4.3 Wire `autoUpdateCheck` to automatic checks and `autoUpdateDownload` to automatic download, keeping both defaults as they are today.
- [ ] 4.4 Feed `scripts/release-notes.sh`'s output with an appcast `<description>`, and resolve open question 2 by choosing where `appcast.xml` is published.
- [ ] 4.5 Verify the update path end to end: a newer signed entry is offered with its notes, an entry with a bad signature is refused, an unreachable feed reports a failed check while the dock keeps showing usage, and an up-to-date install says so.
- [x] 4.6 Carry settings over once from the Electron app's `capsule-settings.json` (schema v7) and its readings, penalties and token cache, recording that it has happened; a missing, corrupt, or pre-v7 file falls back to defaults and opens onboarding.
- [ ] 4.7 Revert the bundle identifier to `com.antick.capsule` — done, along with the Application Support folder — and build a signed and notarized `arm64` `dmg`. `scripts/package-macos.sh` and the Release workflow sign and notarise when the Developer ID secrets exist; none are set yet, so no signed build has been made.
- [ ] 4.8 Publish the native build as the release artifact. The Electron app was removed from the tree at the user's request rather than kept for one release; it is recoverable at the `electron-final` tag.
- [x] 4.9 Update `CHANGELOG.md`, and rewrite the README's install section: the native app needs an Apple Silicon Mac on macOS 14 or newer, and Intel Macs stay on the final Electron release.

## 5. Phase 4 — Removal

- [x] 5.1 Delete `apps/desktop` and `packages/*`. Done early, at the user's request, before a native release shipped; the last commit with them is tagged `electron-final`.
- [x] 5.2 Delete `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, the root `package.json`, `pnpm-lock.yaml`, `.npmrc`, and the Node scripts, replacing the release scripts with shell (`scripts/release-notes.sh`, `scripts/tag-release.sh`, `scripts/package-macos.sh`, tested by `scripts/test-scripts.sh`) and the CI with `swift build` and `swift test`.
- [x] 5.3 Rewrite `openspec/config.yaml`'s stack context block for the Swift app.
- [x] 5.4 Rewrite `AGENTS.md`'s Stack, Conventions, and heavy-command sections for a SwiftPM project, keeping the auto-commit, no-hard-coded-values, shared-date-formatter, 500-line, and changelog rules.
- [x] 5.5 Re-point the fixture notes in `fixtures/README.md` now that only the Swift suite consumes the corpus; `CapsuleFixtures` finds it by `Package.swift`.
- [x] 5.6 Update `CHANGELOG.md`.
