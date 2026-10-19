# Changelog

All notable changes to Capsule are documented in this file.

## Unreleased

### Fixed

- macOS no longer asks for the login keychain password every few minutes. Capsule now reads Claude's sign-in through `/usr/bin/security`, the tool Claude Code writes it with, so a token refresh no longer revokes Capsule's access.

## 0.2.1

### Fixed

- Scheduled update checks stay quiet while an update is waiting to download or install.

## 0.2.0 — signed native release

### Added

- Native Swift/AppKit app for Apple silicon on macOS 14 or newer, with live provider usage, reset times, and passive activity notices.
- Signed and notarized Apple silicon installer with an Applications shortcut.
- Verified in-app updates, download progress, and restart-to-install through Sparkle.
- Capsule Dev with a blue icon, separate settings and caches, and no production updates.
- Automated release checks, signed update feed, checksums, and release recovery instructions.

### Changed

- Public releases require Apple signing and notarization; unsigned publishing is blocked.
- New builds support Apple silicon only, including every bundled updater helper.
- Usage monitoring remains available for Claude, Codex, Grok, and Cursor.

## Amber-and-cream identity

### Changed

- Capsule now uses an amber progress meter inside a cream capsule on charcoal, with transparent outer corners and all macOS app-icon sizes.
- The menu bar uses a matching monochrome mark. Settings, updates, About, and the running app share the same native artwork, including when launched without a bundle.
- Added a repeatable icon asset generator using the shared drawing.

## Every limit on the card

### Fixed

- Claude sessions idle for hours or weeks showed as working. The reader replayed each transcript over Claude Code's own status, and a transcript cannot tell a turn still running from one interrupted and left. Now whichever spoke last wins: Claude Code's status, or a transcript event newer than it.
- Cursor showed 0% on plans that meter included usage per week: the app read only the monthly summary, which stays at zero for them. It now reads the current period the way Cursor's own dashboard does, and shows all three rows — total usage, Cursor's own models, and other models — with the monthly summary as the fallback.

### Added

- The card is wider, 280 points at the default size instead of 232, so session names, statuses and reset times fit.
- Claude's card shows every limit Anthropic lists for the account, including a weekly limit scoped to one model, under that model's name. Responses without the list keep the session and all-models windows.
- Local builds are signed with the Developer ID found in the keychain, so every build has the same identity and Little Snitch rules and keychain approvals survive rebuilds. Builds fall back to ad hoc signing where there is none.

## JSON kept out of the card

### Fixed

- A usage request that gets no answer now gives up after 15 seconds instead of 60. Providers are read one after another, so one blocked endpoint held every other reading up by a minute.
- Failed reads, rate limits, and Claude falling back to its cached reading are logged with their reason (a status, never a token), so a stale reading can be explained.
- Raw JSON could pop up in the card as an activity notice. Codex runs internal "guardian" reviewers as sub-agent threads, and their final message is a JSON verdict, which became a "task completed" notice. Codex sub-agent threads, guardians and spawned children alike, are no longer listed as sessions, and a summary that is itself a JSON object or array is never shown.

## Copilot removed

### Removed

- GitHub Copilot as a provider: its usage reader, its mark, its settings row and its fixtures. With it goes the app's only reason to run a local command (`gh auth token`), so the command runner is gone too and the app no longer starts other programs.

### Changed

- A settings file that still lists Copilot keeps every other setting: the retired provider is dropped instead of the whole file being refused and reset to defaults.
- The README no longer carries a project layout section.

## GPL license

### Added

- Capsule is now licensed under the GNU General Public License v3.0 or later: the `LICENSE` file and a License section in the README. The `"license"` fields the change also added to the workspace `package.json` files went with the TypeScript packages.

## Fewer provider calls, and the last of the dock's motion

### Fixed

- With Reduce Motion turned on, the app crashed at launch: snapping the dock instead of animating it re-entered itself without end. Found by CI, whose machines run with Reduce Motion on.
- Grok now backs off when rate-limited, honouring `Retry-After`, like the other providers; before, a 429 failed as a plain error and Grok was asked again every poll.
- Changing a setting no longer re-reads every provider: only switching providers on or off does. Each step of the size slider and every dock drag used to send a full round of usage requests.
- Waking, unlocking and the network returning now share one read a minute instead of each starting a round.
- Clicking a meter re-reads its provider at most once every 15 seconds.
- A provider that answered "not signed in" is asked again every 5 minutes rather than every poll — for Codex that also meant posting its refresh token each minute. Clicking its meter still asks at once.
- No focus ring is drawn round the first page in the settings sidebar.

### Added

- Resizing the dock eases through the sizes in between, with the window holding both sizes until the ease is done, as the Electron dock did.
- A dragged rail lifts slightly off its edge, and the cursor shows an open hand on the rail, a pointing hand on a meter, and a closed hand while dragging.

## Native migration — the Swift app replaces Electron

### Added

- The native dock in full: meters whose arcs spring to each reading, a refresh sweep, an arc for agents working or waiting, the card with readings, token totals and live sessions, activity notices with unread badges, the auto-hide latch and its beacon, Show Dock, Keep open, and drag-to-snap onto any edge and display.
- Hover tracking from mouse event monitors instead of a 24 ms cursor poll: the dock takes the mouse only over itself, and its concave fillets let clicks through.
- The menu-bar item, the dock's right-click menu and the application menu, with Position, the update item and the shortcuts.
- Settings and onboarding in SwiftUI: a live preview of the dock, style, theme, size, placement, behaviour, providers, updates and general settings, with launch at login through the system's login-item service.
- Updates check GitHub's latest release and link to its page.
- On first launch the app adopts the Electron app's schema v7 settings, last readings, penalties and token cache, once. It now runs as `com.antick.capsule`.
- Snapshot tests that render every dock style, edge, theme and card state, and every settings page, to PNG; interaction tests that drive the real panel with synthetic events.
- Release scripts in shell (`scripts/version.sh`, `release-notes.sh`, `tag-release.sh`, `package-macos.sh`, tested by `test-scripts.sh`) and CI on `swift build` and `swift test`.

### Changed

- Measured on the same Mac in demo mode: the dock appears in 0.25 s instead of 0.63 s, and the app settles at a 58 MB footprint in one process instead of 551 MB across four.

### Removed

- The Electron app, the TypeScript packages, pnpm, Turborepo and Biome. The last commit with them is tagged `electron-final`, which also keeps the suspended agent chat source.

### Fixed

- Demo mode with Cursor or Copilot switched on refreshed in an endless loop, flashing a sweep across every ring and redrawing the card on every pass.
- A dock dropped at a remembered position could be drawn a point away from it, because the window and the rail's offset were rounded separately. Fixed in the shared placement engine.
- Freed parsing memory from the token scan is handed back to the system after each scan.

### Known

- Updates are not installed in place yet: that needs Sparkle, an EdDSA key pair and a published appcast (tasks 4.1–4.5).
- Releases are unsigned until the Developer ID secrets are set (docs/releasing.md).

## Native migration, phase 2 — the shell starts

### Added

- `CapsuleApp`, the native app as a menu-bar accessory with no Dock tile, built into `Capsule.app` by `scripts/bundle-macos.sh` under the side-by-side identifier `com.antick.capsule.native`.
- The dock's window: a non-activating floating panel on every Space that can never take focus, drawing the resting rail through `CapsuleHUD`'s outline over vibrancy, in the theme's palette, placed by the same engine as the Electron dock.
- `CapsuleShell`, which runs the usage poller, activity monitor and token scanner on the real Mac: the poll interval, wake, screen unlock, the network coming back, and file changes in the Claude sessions directory each prompt the read the Electron app makes for them.
- A menu-bar item with Quit.

### Known

- A development build is signed ad hoc, so a network filter such as Little Snitch or LuLu asks about it again after every rebuild, and its reads wait on that prompt until it is answered.
- No meters, cards, hover or settings window yet; the dock lets every click through.

## Providers no longer invent a zero

### Fixed

- A usage response Capsule cannot read no longer shows up as `0% Used`. Given a payload carrying no utilization, `mapClaudeUsage`, `mapCodexUsage` and `mapGrokCredits` reported `primaryPercent: 0` with status `ok`; Claude and Grok also fabricated a bucket — an "All models" row at 0% resetting "now", a "Weekly credits" row at 0%. All three now draw a bucket only for a window the payload actually carried, take the headline percent from the first bucket there is, and report status `error` when there is none, so the dock keeps the last good reading and dates it as stale instead of claiming the provider is untouched. `mapCursorUsage` and `mapCopilotUsage` already behaved this way.
- A Claude usage cache whose windows carry a reset time but no utilization is no longer remembered as a reading.

### Changed

- Re-recorded the Claude, Codex and Grok mapping fixtures against the fixed mappers, and added cases for the paths the fix opens up: a Claude payload with only a weekly window, a Codex window reporting a reset but no percentage, and a Grok product row with no headline credit percent. The corpus is now 102 cases across 21 files. The real mappings — Claude 73/7, Codex 21/8, Grok 52/18 — are unchanged.

## Native migration, phase 1 — Swift host layer

### Added

- The fixture corpus now drives each provider's whole read against a stub world, recording every request made; the poller through scripted steps; and the activity readers, token scanner and monitor against a stub machine, recording every query and tail read. 987 cases across 73 files.
- Swift ports of all of it: the five providers' reads, the usage poller, the Claude, Codex and Grok readers, the token scanner and the activity monitor. 932 of the corpus's 987 cases pass in Swift.
- New `CapsuleSystem` module with the real macOS hosts, the only Swift module that touches the machine: read-only SQLite, local commands, the keychain, files, a guarded tail reader, process start times, an FSEvents directory watcher and a JSON store.

### Fixed

- The Swift poller does not loop when every provider is switched off, which the Electron app's does; the TypeScript fix is proposed separately.
- Two bugs in the earlier Swift usage port, caught by the new scenarios: Claude's reset times were normalised where the original passes them through, and a token refresh answering 200 with a non-JSON body read as "no token" instead of failing.

### Known

- Grok's usage read has no rate-limit branch, so the poller never backs off for it. Recorded faithfully in the corpus and in the Swift port; the TypeScript fix is proposed separately.

## Native migration, phase 1 — Swift passive activity

### Added

- New `CapsuleActivity` module: Claude registry parsing and process start times, the Codex activity hint, local event evidence for Claude, Codex and Grok, the notice tracker, and token counting from transcript rows. All nine activity fixtures pass.
- All four Swift logic modules now exist. 822 of the corpus's 877 cases pass in Swift; the rest are update wording deferred to the Sparkle work and the pre-v7 settings migrations the native app deliberately skips.

### Fixed

- Date parsing and formatting built a new formatter on every call. They now share formatters built once, which took a thousand-update notice-tracker run from 28 seconds to 8 in a debug build.

## Native migration, phase 1 — Swift HUD silhouettes

### Added

- New `CapsuleHUD` module: the path builder, dock layout, rail and bubble outlines, frame padding, hit regions, and the latch and its fold. All eight silhouette fixtures — 271 cases — pass with exact equality on every path coordinate.
- Outlines convert to `CGPath` for the dock's shape layers, with native checks that each one makes the shape it describes.

## Native migration, phase 1 — Swift core geometry and settings

### Added

- `CapsuleCore` now carries the HUD's metrics and scale stepper, rail and card sizing, notch geometry, placement and edge snapping, dock styles, settings parsing, and session summary and ordering. Twenty more fixtures pass in Swift; `swift test` runs 53 tests.
- `jsRound` and `jsFixed2` stand in for JavaScript's `Math.round` and `toFixed(2)`, which round halves differently from Swift. Every ported call goes through them.
- `CapsuleSettings.read` adopts only schema v7 files and returns nil for anything older or unversioned, so the native app starts from defaults rather than guessing at a migration.

### Changed

- `JSONValue` moved from `CapsuleUsage` into `CapsuleCore` and became `Codable`; settings parsing reads through it field by field.

## Native migration, phase 0 — config, activity and HUD fixtures

### Added

- Extended the fixture corpus to 877 cases across 65 files. Config adds placement and slide tracks, edge snapping, HUD metrics and scale snapping, card and rail sizing, notch geometry, settings parsing, update wording and session ordering. Activity adds Claude registry parsing, the Codex activity hint, local event evidence for Claude, Codex and Grok, the notice tracker replayed over step sequences, and token counting. The HUD adds dock layouts, rail and bubble outlines for every edge and style, hit regions, the latch and its fold, and the path builder's primitives.
- Added a `wontPort` list to the Swift coverage gate for fixtures the native app deliberately does not match, each with the decision that explains it. Pre-v7 settings migrations are the first entry.
- `fixtures/README.md` now records the traps a port must get right: JavaScript's rounding of negative halves, floating-point-sensitive scale snapping, stable sorts and tie order, string-ordered timestamps, three different epoch heuristics, and insertion-ordered sets.

### Changed

- Inline tests that only re-asserted a value the corpus now records are removed; tests that assert a property of the output stay. Config's `activity.test.ts` and `settings.test.ts` are retired as a result.
- The shared golden helper moved into `@capsule/fixtures/vitest` and compares JSON-shaped values, so a `Date` matches its recorded ISO string.
- The HUD package typechecks in two programs: source with no ambient types, so Node globals cannot reach renderer code, and tests with Node's types for the fixture loader.
- Biome skips `fixtures/**/*.json`. The recorder is the corpus's only writer, so a re-record shows only the values that moved rather than a formatter's whitespace.

## Native migration, phase 1 — Swift usage readers

### Added

- Added `CapsuleUsage`: snapshot types, percent clamping, rate-limit backoff and `Retry-After` parsing, snapshot merging, and payload mapping plus token reading for all five providers — Claude, Codex, Grok, Cursor and Copilot.
- Every one of the 21 extracted fixtures is now ported. `swift test` runs 26 tests over the same corpus the Vitest suites read, and the not-yet-ported list in the coverage gate is empty.
- Provider mapping is checked by whole-snapshot equality rather than a few fields, so any difference anywhere in a mapped snapshot fails the port rather than passing unnoticed.

### Changed

- Reading an epoch reset time, a provider token, or a JSON payload is now typed through `Codable` instead of cast, so a shape a provider did not send is a decode failure rather than a silent `undefined`.

## Native migration, phase 1 — Swift core

### Added

- Added `Package.swift`, a SwiftPM package at a `macOS 14.0` floor, Apple Silicon only. `CapsuleCore` carries the first ported logic: severity bands, reset and elapsed copy, day keys, and compact token counts.
- Added a Swift corpus loader that finds the repository's `fixtures/` by walking up to `pnpm-workspace.yaml`, the same way the TypeScript loader does, so both suites read one copy of every case and neither owns it. `swift test` runs 11 tests in 4 suites against it.
- Added a corpus coverage gate that fails when a fixture exists that no Swift test reads and nobody has listed as not-yet-ported, so the corpus cannot quietly outgrow the port.
- Reset copy normalises the space before AM/PM. Foundation can emit a narrow no-break space there where JavaScript emits an ordinary one; an explicit format template avoids it today, and a test now fails if a toolchain changes its mind rather than every dock gaining an invisible character.

## Native migration, phase 0 — fixture corpus

### Added

- Added `fixtures/`, a JSON corpus of extracted test cases read by both the TypeScript suites and, from phase 1, the Swift suites. It is how the Swift/AppKit migration transfers proven behaviour instead of re-deriving it. 99 cases across 21 files so far: usage mapping, token reading, snapshot merging, backoff, reset-time formatting, severity bands, and token-count formatting.
- Added `@capsule/fixtures`, the loader for that corpus. It refuses a fixture with no cases, throws rather than falling back to the real clock when a case declares a frozen `now`, and can re-record provider-mapping expectations under `CAPSULE_WRITE_FIXTURES=1`.
- Added `fixtures/README.md` covering the file shape, hand-written versus recorded expectations, what stayed inline as deliberately not portable, and what phase 0 still has to extract.

### Changed

- Re-pointed the date, severity, clamp, backoff, token-count and provider-mapping tests at the corpus. Each case is now its own test, so the suites report per-case rather than per-group.
- Provider mapping tests now assert the whole mapped snapshot rather than the few fields a hand-written assertion reached for, which is what a Swift port has to reproduce.
- Every package's `test` script pins `TZ=UTC`. There was no vitest config and no timezone pinning, so the date tests passed only because local-time construction and local formatting cancelled out; a corpus shared with Swift cannot rely on that.

### Fixed

- Nothing in this change, but the extraction found a bug worth naming: given a payload carrying no utilization, `mapClaudeUsage`, `mapCodexUsage` and `mapGrokCredits` returned `0%` with status `ok`, and Claude and Grok also fabricated a bucket. Cursor and Copilot correctly returned nothing. A successful response Capsule did not understand therefore showed a confident `0% Used`. The cases were recorded as-is and flagged in their notes, and fixed next — see "Providers no longer invent a zero".

## Public-repo privacy sweep

### Changed

- Replaced a real home-directory path and personal project name in activity and HUD test fixtures with generic sample values.

## 0.1.0 — first release

### Added

- Capsule is now released as a signed-capable macOS build. `pnpm release:tag` cuts the tag from the version in `apps/desktop/package.json`, and pushing that tag builds arm64 and x64 DMGs and zips and publishes them to GitHub Releases.
- Added an Updates page in Settings: current version, a manual check, release notes, download progress, and a restart-and-install button. Automatic checking runs on launch and once a day; background downloading is available and off by default.
- Added "Check for Updates…" to the menu bar and tray menus. It becomes "Restart to Update" once a release has been downloaded.
- Added an app icon drawn from the dock itself — three usage rings in a capsule rail.

### Changed

- Rebuilt the settings window. It now follows the macOS appearance in both light and dark, with a vibrant sidebar carrying icons, the running version, and a live update status; pages open with a title and a one-line description; and settings sit in cards rather than one long list.
- Split Appearance into Dock style, Theme, Dock size, Placement, and Behaviour, and split General into Usage readings and System.
- Usage percentages in Settings now use tones that stay readable on a white panel. The dock's own severity colours are unchanged.

### Fixed

- An update check that cannot reach GitHub now reports the failure instead of showing "Checking…" until the app is restarted.


## README refresh

### Added

- Added real macOS captures of Capsule's dock and settings, taken from a temporary demo profile with provider requests blocked.
- Added a second settings capture covering themes, edge placement, auto-hide, and dock size.

### Changed

- Replaced the short developer README with an original product overview, provider support table, honest data boundaries, local setup, checks, and project layout.

## Corner curves suspended

### Changed

- Removed Curl into corners from settings and disabled corner placement. Saved and incoming corner settings are cleared so startup, settings changes, and dragging cannot reactivate it.
- Preserved the corner implementation for later. Regular edge placement, auto-hide, usage monitoring, and notifications remain available.

## Corner curves with auto-hide

### Fixed

- Curl into corners now works with Hide until needed. The arc folds into a thin curve, remains reachable, and expands on approach using the existing animation and reduced-motion behavior.
- Enabling the curve while already parked in a corner applies it immediately and saves that corner. Startup recovers previously enabled corners left unset by the auto-hide restriction. Unrelated provider and size changes still do not curl a straight dock unexpectedly.
- A saved top corner takes priority over the centered notch. Corner cards, usage navigation, and notification indicators remain available.
- Added native checks for all four corners, hover and hide behavior, card bounds, and saved drag positions.

## Notification access and clearing

### Fixed

- Provider clicks now open and refresh usage reliably. Pointer capture stays on the pressed button until a drag begins, so an ordinary click reaches its button and release events are still handled at the dock edge.
- Opening notifications from a badge or the usage card clears that provider's unread count automatically. Both entry points cancel pending hover timers so they cannot replace the requested list.

### Added

- An Activity button in provider usage cards opens retained notifications. Each notification has its own dismiss button, and Clear all removes notifications and history across every provider.
- Native regression checks use real pointer clicks and cover unread counts, individual dismissal, clear-all across providers, history, deduplication, and dragging.

## Notification and activity fixes

### Fixed

- Notification numbers now count unread alerts only. Opening a notification list or reading its popup clears the count; a small history dot keeps read alerts available until dismissed. Continuing a task also marks its earlier completion read. Every retained alert is accessible in the scrollable list.
- Claude Code activity now follows current transcript state when the session registry omits status fields, using stable task identities. Grok discovers current event logs even when its legacy registry is not updated. Codex retains explicit recent activity beyond an eight-second write gap.
- A new turn clears the previous completion signal. Events discovered more than a minute late do not generate new popups, and notification subscription updates cannot be overwritten by an older initial snapshot.
- Completion notices include a brief result preview when available and use “Task completed” as the fallback.
- The top latch remains above the menu bar while its context menu is open, with the menu itself above the latch.

### Added

- General → Show notification popups, enabled by default. Turning it off keeps unread counts and animated provider icons without automatically opening cards. Existing usage display, providers, tokens, hide-delay, placement, and chat suspension are preserved.
- An isolated native regression script covering local event files through the tracker, IPC, unread/history controls, popup preference, and usage navigation.

## Usage monitoring restored alongside notifications

### Fixed

- Restored usage titles and meter percentage captions. Hovering or clicking a provider opens its usage card even when notifications are pending; separate badge buttons reopen notifications. Activity indicators and automatic popups remain additive.
- Restored the pre-existing Claude, Codex, and Grok usage readers, refresh timing and settings after the user clarified that the suspension applied to chat only. Chat startup, commands, connections, and panel remain disabled.

## Passive activity notifications

### Added

- Local Claude Code, Codex, and Grok activity detection with explicit finished-response and input-request notices. Bounded session-log reads, process checks where available, startup history suppression, and deduplication keep alerts local and quiet.
- Connected notification cards use the latch's existing springs and reduced-motion behavior on every edge, with theme-aware amber/green accents, grouped task names, count badges, hover pause, dismissal, and click-to-reopen.

### Changed

- Provider cards show local activity while account access stays disabled. Unconfirmed signals do not claim an agent is working. Agent chat remains preserved and inactive; no credentials, provider requests, hooks, or connections are enabled.

## Account access disabled

### Removed

- Removed Claude, Codex, and Grok saved-credential usage readers, keychain access, token refreshes, direct account endpoint calls, and the live polling timer. Live readings now say disabled; demo mode and local passive activity remain available.

### Changed

- Suspended agent chat without deleting its implementation. Removed startup wiring, menu and meter actions, chat IPC forwarding and handlers, and the chat renderer build. The connection manager and panel are guarded off; old channel launch commands exit without starting MCP or sockets. Re-enabling requires an explicitly reviewed source change.
- Replaced sign-in guidance with the disabled state and removed the inactive refresh-interval control.

## Agent panel

### Added

- Click a provider meter or use the Agents menu to open a keyboard-friendly panel beside the latch. Browse sessions, read recent messages, keep separate drafts, and send follow-ups through connected Claude Code channels or a compatible existing Codex control socket.
- Explicit Codex command approval controls, connection setup instructions, and clear view-only states for sessions that cannot accept messages. Claude tool approvals stay in Claude Code.

### Fixed

- Passive Codex monitoring retains multiple recent threads instead of collapsing them into one, and labels inferred activity as unconfirmed.
- Main-process builds keep Electron external when bundling the standalone Claude channel entry.

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
- The dock now hides until it is needed, on by default in Settings → Appearance → Placement. At rest it retracts into the screen edge and leaves a slim latch behind; reaching for that latch unrolls the rail back out and the meters arrive one after another rather than all at once. The latch answers to a band around it rather than to its own few pixels, and carries a hairline so it stays visible on a dark desktop as well as a light one.
- "Show Dock", in the menu bar extra, the dock's own context menu (⌘⇧D) and Settings → Appearance → Placement. A hidden dock is a few pixels of latch, which can be all but invisible on a dark wallpaper, so this unrolls it and holds it out for a few seconds before letting it retract on its own.
- A provider whose usage is being fetched says so with a bright arc that chases round its ring. The numbers already on screen stay put underneath, and the rings clear one at a time as each provider's fetch lands. Clicking a meter asks for that provider to be read again, so the sweep is on demand as well as on the poll.

- The rings say whether an agent is working. A thin arc inside a provider's ring spins while one of its sessions is busy and becomes a slowly breathing amber ring when one is blocked waiting on you. Claude Code sessions are read from the registry it keeps in `~/.claude/sessions`, checked against the process table so a crashed session cannot claim to be working forever; Codex is read from the rollout log its CLI and editor extension append to, and from the desktop app's own thread catalogue, and counts as working for a few seconds after its last write. Hover the ring for every live session by name, where it is running, what it wants, and how long it has been like that; long lists are cut and counted.
- Click the rail to keep the dock out. An auto-hiding dock stays unrolled after the pointer leaves until it is clicked again, and the same hold is a checked "Keep open" item in the menu bar and the dock's own menu (⌘⇧K). It is a gesture, not a setting: it lasts as long as the app runs, and it is greyed out while the dock is set to always show.
- The top edge is drawn as a notch on every display. Centred, straight-sided and rounded underneath, at rest it is a notch-sized black tab sitting in the menu bar, and reaching for it makes the notch grow into the bar with the readings hanging below the menu bar. On a MacBook the tab is the display's own notch — same width, same height, moulded into the frame with a small fillet — so the two read as one shape and nothing shows at rest; Electron does not know about the camera housing, so AppKit is asked through the scripting bridge and the answer is remembered per display. On any other screen the dock draws a MacBook-width notch exactly as deep as the menu bar. "Draw as a notch" in Settings → Appearance → Placement (shown for the top edge) is on by default; off, the top dock is a plain bar you can drag along the edge. Setting `CAPSULE_FAKE_NOTCH=200x37` while developing pretends the display has a hardware notch of that size.
- Usage polls at full rate only while an agent is working; with every agent idle it drops to once every five minutes, since numbers that cannot have moved are not worth the rate limit. A 429 now backs off properly: a minute, doubling per refusal, capped at fifteen minutes, with the server's own hint treated as a floor-raiser rather than an order, remembered across launches so a relaunch waits the penalty out. Meanwhile the last good numbers stay on screen and the card header says how old they are.

- Cursor and GitHub Copilot join the providers. Cursor's plan usage is read with the editor's own session, taken from its state store the way the editor's dashboard does it; Copilot's premium-request and chat quotas are read with whatever GitHub login this Mac already has — an explicit token, the gh CLI's, or Copilot's own. Both start switched off in Settings → Providers so nobody gets two empty rings they did not ask for; turn one on and its ring appears with the others. Neither tool leaves a session record that can honestly say whether an agent is working, so they show usage only.
- The dock remembers its last readings. At launch each ring shows the numbers it had when the app last ran, dated and marked as last-known, instead of a row of dashes until the first fetch lands.
- A folded dock carries a dot: white while an agent is working, amber and breathing while one is waiting on you. The glance has to work while the dock is hidden, which is when it matters most.
- The card counts tokens. Under the readings, Claude and Codex show how many tokens their agents have got through today and over the last thirty days, read from the transcripts and rollouts they keep locally. Only files that changed since last time are re-read, and per-file totals are remembered across launches, so a fresh start does not re-parse months of history. Counts only, no estimated cost: prices go stale and a wrong number is worse than none.
- "Show usage as" in Settings → General flips the rings, bars and percentages between what has been used and what is left. The colours keep answering how close to the limit you are either way.
- Resets due today or tomorrow say so ("Resets today 3:00 PM") instead of naming a weekday.

- "Hide after" in Settings → Appearance → Placement sets how long an auto-hiding dock waits before it folds: instant, quick, normal or relaxed.

### Fixed

- Turning a provider on or off no longer flips back by itself. A refresh already on the wire landed the provider list it had started with, undoing whichever toggle happened while it was out; it now lands against what is enabled at that moment and reads any newly enabled provider straight after.
- The dock no longer curls into a corner on its own when a provider is added. The corner was worked out from where the rail happened to sit, so a rail that grew a ring reached the end of its track and bent. The corner is now the one the dock was actually dropped into, and it is remembered as such.
- The corner arc is ignored while the dock hides until needed. The arc has no latch to fold into, so an auto-hiding dock curled into a corner drew a band with no rings on it. Now it stays a straight rail; turn "Hide until needed" off to use the arc.
- An empty provider list no longer paints a ring for every provider Capsule knows; it falls back to the default three.
- The dock no longer flashes a gap along the screen edge as it unrolls. Its arrival was springing past the edge and settling back, which pulled the rail clear of the border for a frame or two on the way in.
- A card no longer stays open after the pointer has gone. The window turns click-through the moment the cursor leaves it, and a click-through window raises no `pointerout`, so the dock was never told; the hit test the main process already runs now says so directly. The same signal retracts an auto-hiding dock, and leaving now drops a pinned card rather than stranding it open with nothing on screen to dismiss it.
- An auto-hiding dock no longer retracts while the cursor is still resting on it. The rail sliding out from under a stationary pointer raises `pointerleave` by itself, and the dock was taking that at face value.
- "Curl into corners", off by default in Settings → Appearance → Placement. With it on, dragging the dock all the way to the end of an edge bends it into a quarter arc that traces the screen corner: the meters keep their spacing but ride the curve, the percent captions drop the way they do on the top edge, and the card squares up against the band and opens inward so it never lies across the ring.

### Changed

- The dock moves on springs. Every movement — the latch unrolling, the card popping out, the tail gliding between meters, a ring sweeping to a new reading — used a fixed-duration eased curve, and the surface read as a slideshow next to a native panel. Each now follows a spring described the way SwiftUI describes them (a response time and a damping fraction), kept in one place so the whole dock moves like one thing. CSS follows the same curves through `linear()` easings sampled from the spring, and anything driven frame by frame keeps its momentum when its target changes mid-flight, so a quick hover in and out is one gesture rather than two animations.
- The latch is the rail, folded down. Unrolling used to slide the rail in from the screen edge while a separate tab cross-faded away, which read as two objects swapping. The rail's outline now grows out of the sliver on the edge into its full shape, and the meters are masked by that same outline as it opens and closes — swallowed by the shape rather than sliding out of the end of it. They slide a few pixels toward the edge and fade, each a beat after the one before, instead of shrinking; the outline is already doing the concealing, and scaling on top of it read as two effects fighting.
- Swapping the open card from one provider to another now glides. The card's height eases to the new size on the same spring as its tail, the new rows fade in rather than cutting over, and the hit area is cut from where the card is going rather than republished on every frame in between.
- A ring presses in slightly while its provider is being re-read and releases when the number lands, so clicking it feels like pressing the button it is. A reading that changes sweeps to its new value slowly enough to read as a measurement being taken rather than a glitch.
- The dock honours the system's reduced-motion setting: springs snap to their targets and transitions are cut to zero.

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
- The dock is lit like a card resting on the desktop: a tight contact shadow plus a wide ambient one at low alpha, instead of a single heavy cast. The old shadow spread a grey cloud over anything behind the card — directly under it a white window lost thirty levels of brightness across a band wider than the card itself.

### Fixed

- The Electron / Capsule icon no longer stays in the macOS Dock. Putting the HUD on every Space called `setVisibleOnAllWorkspaces` with `visibleOnFullScreen: false`, and Electron treats that as `dock.show()` — which undid every hide. The overlay now skips that process-type transform, Capsule runs as an accessory app, and the Electron.app used in `pnpm dev` is marked `LSUIElement` so the tile never appears at launch.
- Changing the dock's size eases between the two sizes instead of jumping. Every dimension was rounded to the nearest 10% step before it was drawn, so the animation could only land on the seven sizes the stepper offers and arrived as a staircase; the render path now draws the sizes in between, while settings still only ever store a step. The window is held at the larger of the two sizes for the length of the change so the artwork is never clipped on its way down, and it is anchored against the docked edge so the dock does not drift while it grows.
- The rail and the card cast one shadow between them rather than one each, so the card no longer prints its own shadow across the rail at the join and split what should read as a single surface. The card's text sits outside the shadowed layer entirely.
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
