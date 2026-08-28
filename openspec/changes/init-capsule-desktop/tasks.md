## 1. Monorepo scaffolding

- [x] 1.1 Add root `package.json` (`name: capsule`, `private: true`, `packageManager: pnpm@11.22.0`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (`lint`, `format`, `check`, `typecheck`, `test`, `dev`, `build`), and `.gitignore` for `node_modules`, `dist`, `out`, `.turbo`. Do not delete existing slashism markdown posts.
- [x] 1.2 Add root `biome.json` using `@biomejs/biome` `2.5.9` as the only linter/formatter and a `packages/tsconfig` base for Node (main) and bundler (renderer) projects.
- [x] 1.3 Create empty package stubs with `package.json` names `@capsule/config`, `@capsule/dates`, `@capsule/usage`, `@capsule/hud`, `@capsule/ui`, and `apps/desktop` using the pinned versions in `design.md`.
- [x] 1.4 Pin every dependency in those manifests to the design.md table; do not add Electron 44, Turbo 2.10.12, Biome 2.5.11, TanStack Router 1.170.32, lucide-react 1.35.0, shadcn 4.19.0, or TypeScript 7.x.
- [x] 1.5 Run `pnpm install` and `pnpm exec turbo run check` so the empty workspace typechecks/lints.

## 2. Shared config and dates

- [x] 2.1 Implement `@capsule/config` with named exports for `APP_NAME`, severity bands/colors, HUD geometry, placement presets, poll/chrome intervals, provider IDs, Anthropic usage URL + beta header, and `DEMO_SNAPSHOTS` (Claude 73/7, ChatGPT 21, Spark 52).
- [x] 2.2 Add a Zod schema for persisted settings (`placementPreset`, `enabledProviderIds`, `demoMode`, `pollIntervalMs`, `launchAtLogin`) in `@capsule/config`.
- [x] 2.3 Implement `@capsule/dates` `formatResetRelative` and `formatResetAbsolute` exactly as specified (`Resets in 51 min`, `Resets in 2h 10 min`, `Resets Thu 12:00 AM`).
- [x] 2.4 Add Vitest coverage for both formatters and for severity-band lookup (21 → low, 52 → mid, 73 → high, 95 → critical).

## 3. Usage providers

- [x] 3.1 Define `UsageBucket` / `UsageSnapshot` / `UsageProvider` in `@capsule/usage` and a `clampPercent` helper (0–100).
- [x] 3.2 Implement the demo provider that returns `DEMO_SNAPSHOTS` including the pinned demo clock for Claude reset copy.
- [x] 3.3 Implement snapshot merge so a failed fetch keeps the last good snapshot and sets `status` to `stale` or `error`.
- [x] 3.4 Implement unauthenticated snapshots that omit `primaryPercent` rather than reporting `0`.
- [x] 3.5 Implement the Claude adapter: read local Claude Code / Anthropic OAuth credentials, call the configured usage URL, map `five_hour` → `Current session` (primary, relative) and `seven_day` → `All models` (absolute), ignore extra weekly buckets on the card.
- [x] 3.6 Implement the ChatGPT adapter: read local Codex/ChatGPT auth, map primary + secondary windows with ChatGPT labels.
- [x] 3.7 Implement the Spark adapter behind the same interface (demo-backed in v1 if no stable API exists).
- [x] 3.8 Implement the poller (startup, `POLL_INTERVAL_MS`, wake, network-online) that only fetches enabled providers.
- [x] 3.9 Add fixture tests for Claude mapping, clamp, unauthenticated ≠ 0, stale-on-error, and demo snapshots. No live network in unit tests.

## 4. Usage dock HUD

- [x] 4.1 Build `UsageMeter` in `@capsule/hud` (icon, SVG ring, integer percent, severity color) with no Electron imports.
- [x] 4.2 Build `UsageCard` with provider title `"{name} Usage"`, two optional buckets, bars, `{n}% Used`, and reset copy from `@capsule/dates`.
- [x] 4.3 Build `HudFrame` as a single SVG/path surface: rounded inner edge, flush outer edge, card + tail + concave join aligned to the active meter (no detached tooltip).
- [x] 4.4 Build `UsageRail` that stacks meters vertically or horizontally from placement orientation and renders one meter per enabled snapshot.
- [x] 4.5 Implement hover-open (open delay), pointer-move onto card (stay open), leave-close (close delay), and click pin/unpin.
- [x] 4.6 Render unauthenticated meters with an empty ring and a card that says the provider is not connected (never `0% Used`).
- [x] 4.7 Render stale/error meters with the last percent and a card that marks data unavailable/stale.
- [ ] 4.8 Add a Playwright HUD screenshot test using demo data, right-edge, Claude card open, and compare layout to `references/hud-reference.jpg`.

## 5. Desktop overlay shell

- [x] 5.1 Scaffold `apps/desktop` with electron-vite, main/preload, overlay renderer, and settings renderer; product name `Capsule`.
- [x] 5.2 Create the overlay `BrowserWindow` (`transparent`, `frame: false`, `roundedCorners: false`, `type: 'panel'`, `focusable: false`, `skipTaskbar`, always-on-top `floating`, all Spaces, not visible on native fullscreen).
- [x] 5.3 Hide the macOS Dock icon (`app.dock.hide()`).
- [x] 5.4 Implement `setIgnoreMouseEvents` + overlay `setPointerCapture` so transparent pixels click through and the rail/card receive hover and clicks without stealing keyboard focus.
- [x] 5.5 Resize/reposition the overlay when a card opens or closes so the rail stays flush and the card stays on-screen.
- [x] 5.6 Hide the HUD on native fullscreen of the target display and show it again on exit.
- [x] 5.7 Expose a typed preload bridge (`onSnapshots`, `getSettings`, `setSettings`, `openSettings`, `quit`, `setPointerCapture`) with `contextIsolation` on and `nodeIntegration` off; never send tokens to the renderer.
- [x] 5.8 Add HUD context menu with Settings and Quit Capsule.
- [x] 5.9 Persist settings with `electron-store` + the Zod schema; restore on launch.

## 6. Screen placement

- [x] 6.1 Implement the placement engine that maps presets (`right-edge`, `left-edge`, `dock-flank-left`, `dock-flank-right`, `stage-manager-top`, `stage-manager-bottom`) to `{x,y,width,height,orientation,cardGrowth}` using display `bounds`/`workArea` and config insets.
- [x] 6.2 Probe Dock `orientation`, `autohide`, and `tilesize`; keep Dock-adjacent rails in the empty flanks without covering Dock icons, including autohide.
- [x] 6.3 Probe Stage Manager enabled state; place top/bottom gutters in the left strip; fall back to left-edge while Stage Manager is off without forgetting the stored preset.
- [x] 6.4 Recompute on display changes, chrome poll (`CHROME_POLL_MS`), and wake; if the target display disappears, move to the remaining display.
- [x] 6.5 Clamp expanded card position so rail + card stay inside the work area (not under the menu bar, not off-screen).
- [x] 6.6 Default first launch to `right-edge`; persist and restore the chosen preset.
- [x] 6.7 Add unit tests with mock display/Dock/Stage Manager fixtures for each preset and the Stage Manager-off fallback.

## 7. Settings, onboarding, and login item

- [x] 7.1 Initialize shadcn `4.18.0` in `@capsule/ui` and wire Tailwind `4.3.3` in both renderers.
- [x] 7.2 Add TanStack file-based routes for overlay (`/` HUD) and settings (`/`, `/placement`, `/providers`, `/onboarding`).
- [x] 7.3 Build the settings window as a normal focusable window covering placement presets, provider enablement + connection status, demo mode, poll interval, and launch-at-login.
- [x] 7.4 Apply placement and provider enablement immediately from settings without restart.
- [x] 7.5 Implement launch-at-login via `app.setLoginItemSettings` and reflect the real login-item state in the toggle.
- [x] 7.6 Open onboarding/settings on first launch when no providers are connected and demo mode is off.
- [x] 7.7 Enable/disable providers so disabled ones are neither fetched nor shown on the rail.

## 8. Visual acceptance and verification

- [ ] 8.1 Run Capsule on macOS with demo mode: right-edge, three meters (73% high / 21% low / 52% mid), Claude card expanded, connected blob, flush right edge — match `references/hud-reference.jpg`.
- [ ] 8.2 Exercise left-edge, Dock-adjacent left/right, and Stage Manager top/bottom (or the left-edge fallback if Stage Manager is off).
- [ ] 8.3 Exercise hover, pin, leave, click-through beside the rail, typing in another app while hovering, and Quit.
- [ ] 8.4 Exercise Claude live fetch when local credentials exist, and unauthenticated/error cards when they do not.
- [x] 8.5 Run `pnpm exec turbo run test lint typecheck` and confirm every source file is ≤ 500 lines with no duplicated HUD/date/config logic.

## 9. Changelog and docs

- [x] 9.1 Replace the root README with Capsule (dev, run, placement, demo mode). Leave existing blog markdown files on disk.
- [x] 9.2 Add `CHANGELOG.md` documenting the initial Capsule app. Do not add `openapi.json` (no HTTP API).
- [x] 9.3 Confirm no hard-coded colors, intervals, URLs, or date strings remain outside `@capsule/config` and `@capsule/dates`.
