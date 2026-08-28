## Context

Capsule is a greenfield macOS desktop app in a repo that currently only holds leftover slashism.com markdown posts. The product is an always-on-top usage dock whose visual source of truth is `references/hud-reference.jpg`: a black edge capsule of circular meters, with a connected speech-bubble card.

v1 is macOS-only. The HUD is not a normal document window; it occupies unused gutters (screen edges, empty Dock flanks, leftover Stage Manager strip). Usage data comes from provider adapters in the Electron main process. The renderer never sees tokens.

This change also introduces the monorepo and toolchain the rest of Capsule will grow in.

## Goals / Non-Goals

**Goals:**

- Pixel-faithful HUD for the default right-edge, three-meter, Claude-card-open state.
- Configurable placement: right edge, left edge, Dock-adjacent flanks, Stage Manager gutters.
- Live Claude + ChatGPT usage via existing local credentials, plus a third slot and a demo provider that reproduces the reference numbers.
- Settings/onboarding as a regular window.
- pnpm + Turborepo + Electron + React + TanStack file-based router + Tailwind + shadcn + Biome.

**Non-Goals:**

- Windows/Linux.
- Chat, prompts, or wrapping the AI products.
- HTTP API / `openapi.json` (v1 is IPC only).
- Menu-bar extra as the primary UI.
- Deleting leftover blog markdown.
- Shipping signed/notarized auto-update in this change (structure should not block it later).

## Decisions

### 1. pnpm workspaces + Turborepo, not a single package

**Choice:** Root `pnpm-workspace.yaml` + `turbo.json`. App in `apps/desktop`. Shared libraries in `packages/*`.

**Why:** The HUD, usage adapters, date formatters, and constants must be reusable and independently testable. A single Electron package would mix Node-only credential code with React and invite renderer leaks.

**Rejected:** npm/yarn (user-required pnpm). Nx (heavier than this repo needs). One giant `apps/desktop` without packages (duplicates constants and blocks unit tests without Electron).

### 2. Package map

| Package | Runtime | Responsibility |
| --- | --- | --- |
| `apps/desktop` | Electron main + preload + two renderers | Windows, IPC, login item, Dock/Stage Manager probes |
| `packages/config` | isomorphic | Named constants, placement presets, severity bands, Zod schemas for settings |
| `packages/dates` | isomorphic | `formatResetRelative`, `formatResetAbsolute` only — no inline date formatting elsewhere |
| `packages/usage` | Node (main only) | Provider adapters, snapshot types, poller, clamp/map |
| `packages/hud` | React | Rail, meter, detail card, metaball frame — no Electron imports |
| `packages/ui` | React | shadcn primitives for settings only |
| `packages/tsconfig` | — | Shared `tsconfig` bases |

`packages/usage` MUST NOT be imported by any renderer. Snapshots cross the bridge as JSON.

### 3. Electron + electron-vite, not Forge and not a plain Vite SPA

**Choice:** `electron` `43.4.1` + `electron-vite` `5.0.0` + `electron-builder` `26.15.3`. Two renderer entries: `overlay` and `settings`.

**Why:** electron-vite is the least-ceremony way to get main/preload/renderer with Vite 8. Two entries keep the overlay HTML tiny (transparent, no shadcn theme provider) and the settings window a normal app.

**Rejected:** Electron Forge (more generator noise). Tauri (user asked for Electron + Node). A single BrowserWindow (settings would inherit overlay constraints: no focus, no chrome).

Overlay window (main):

- `frame: false`, `transparent: true`, `hasShadow: false`, `roundedCorners: false` (draw our own corners; also avoids the macOS Tahoe Electron corner-mask compositor issue).
- `skipTaskbar: true`, `focusable: false`, `type: 'panel'`.
- `setAlwaysOnTop(true, 'floating')`.
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })`.
- `app.dock.hide()` so Capsule is not a regular Dock app.
- `setIgnoreMouseEvents(true, { forward: true })` by default; overlay renderer forwards `capsule.setPointerCapture(boolean)` when the pointer is over opaque HUD pixels.

Settings window: ordinary `frame: true` (hidden inset title bar is allowed), `focusable: true`, not always-on-top.

### 4. TanStack Router is file-based, and it owns settings; overlay is a one-route tree

**Choice:** `@tanstack/react-router` `1.170.31` + `@tanstack/router-plugin` `1.168.34`.

Overlay routes:

- `src/renderer/overlay/routes/__root.tsx`
- `src/renderer/overlay/routes/index.tsx` — HUD

Settings routes:

- `src/renderer/settings/routes/__root.tsx`
- `src/renderer/settings/routes/index.tsx` — overview
- `src/renderer/settings/routes/placement.tsx`
- `src/renderer/settings/routes/providers.tsx`
- `src/renderer/settings/routes/onboarding.tsx`

**Why:** User-required file-based routing. The overlay does not need nested navigation; settings does (placement, providers, onboarding). Two route trees, two windows.

**Rejected:** React Router. A single shared router with hash paths loaded by both windows (couples overlay startup to settings code).

### 5. HUD is custom SVG/CSS in `packages/hud`; shadcn is settings-only

**Choice:** Rebuild the reference HUD as dedicated components (`UsageRail`, `UsageMeter`, `UsageCard`, `HudFrame`). shadcn/ui (CLI `4.18.0`) lives in `packages/ui` and is used in the settings window (switch, tabs, buttons, select, dialog).

**Why:** shadcn tooltips/cards cannot produce the connected metaball silhouette. Using shadcn for the rail would fight the visual spec.

**Metaball:** one SVG layer, same fill as the rail (`hud.surface`). Rail capsule + card rounded-rect + a circular join at the active meter. No CSS gooey blur (too soft vs the reference). Animate width/path when opening, keep the rail edge flush.

**Ring:** SVG `stroke-dasharray` on a circle; track uses `hud.ringTrack`; arc uses the severity color.

### 6. Placement engine in main, driven by named presets

**Choice:** Main-process module `placement/engine.ts` returns `{ displayId, x, y, width, height, orientation: 'vertical' | 'horizontal', cardGrowth: 'inward' }`.

Presets (in `packages/config`, not literals in the engine):

- `right-edge` (default)
- `left-edge`
- `dock-flank-left`
- `dock-flank-right`
- `stage-manager-top`
- `stage-manager-bottom`

Inputs:

- `screen.getAllDisplays()` / `workArea` / `bounds`.
- Dock: `defaults read com.apple.dock` for `orientation`, `autohide`, `tilesize`; treat `workArea` vs `bounds` as the Dock strip.
- Stage Manager: `defaults read com.apple.WindowManager GloballyEnabled`. Gutter geometry uses `STAGE_MANAGER_STRIP_WIDTH_PX` and `STAGE_MANAGER_THUMB_STACK_INSET_PX` until a native helper is justified.

Recompute on: `screen` display events, `systemPreferences` / poll of Dock + Stage Manager defaults every `CHROME_POLL_MS`, `powerMonitor` resume.

**Rejected:** Accessibility-tree scraping of Dock icons for v1 (fragile, permission-heavy). A Swift helper is a follow-up if constants miss the real leftover region.

Fallback: Stage Manager preset while Stage Manager is off → `left-edge` visually, keep the stored preset. External display gone → primary display, same preset if it still applies, else `right-edge`.

### 7. Provider adapters in main; renderer gets snapshots only

**Choice:** `UsageProvider` interface in `packages/usage`:

```ts
interface UsageBucket {
  id: string
  label: string
  percentUsed: number // already clamped 0–100
  resetsAt: string // ISO-8601
  resetStyle: "relative" | "absolute"
}

interface UsageSnapshot {
  providerId: "claude" | "chatgpt" | "spark"
  displayName: string
  iconId: string
  primaryPercent: number | null
  buckets: UsageBucket[]
  status: "ok" | "unauthenticated" | "error" | "stale"
  fetchedAt: string
}
```

- **Claude:** read existing OAuth token from Claude Code (`~/.claude/.credentials.json` and/or macOS Keychain). `GET` `ANTHROPIC_OAUTH_USAGE_URL` with `ANTHROPIC_OAUTH_BETA_HEADER`. Map `five_hour` → `Current session` (primary, relative reset) and `seven_day` → `All models` (absolute reset). Ignore extra weekly model buckets on the card.
- **ChatGPT:** read Codex/ChatGPT local auth (`~/.codex/auth.json` or documented sibling). Map primary + secondary windows. If the upstream labels differ, use those labels — do not reuse Claude copy.
- **Spark (third slot):** same UI contract. v1 implementation MAY be demo-only if no stable usage API is available; the HUD still treats it as a real provider.
- **Demo:** `DEMO_SNAPSHOTS` in config matching the reference (Claude 73/7, ChatGPT 21, Spark 52, Claude session reset 51 min, all-models Thursday 12:00 AM on a pinned demo clock).

Poller: interval `POLL_INTERVAL_MS` (default 60s, user-overridable), plus startup, `powerMonitor.resume`, and network-online. On error, keep last good snapshot and set `status: "stale"` or `"error"`.

**Security:** tokens stay in main. Preload exposes a typed `window.capsule` with `onSnapshots`, `getSettings`, `setSettings`, `openSettings`, `quit`, `setPointerCapture`. Renderer sandbox on, `nodeIntegration` off, `contextIsolation` on.

### 8. Shared config package — no magic numbers in UI or main

Every numeric, color, URL, delay, and copy fragment used by more than one file lives in `packages/config`. Required keys:

- `SEVERITY_BANDS`: low / mid / high / critical upper bounds (defaults 39 / 69 / 89 / 100)
- `SEVERITY_COLORS`: green / yellow / orange-red / red (match the reference rings)
- `HUD`: rail width, meter size, ring stroke, item gap, card width, card radius, surface `#0A0A0A`, muted label color, hover open/close delays
- `PLACEMENT`: gutter insets, Stage Manager strip width, Dock flank margin, window shadow padding
- `POLL_INTERVAL_MS`, `CHROME_POLL_MS`
- `PROVIDER_IDS`, demo snapshots, Anthropic usage URL + beta header
- `APP_NAME`: `"Capsule"`

### 9. Dates only through `packages/dates`

- Relative, under 60 minutes: `Resets in {n} min`
- Relative, ≥ 1 hour and < 24 hours: `Resets in {h}h {m} min`
- Absolute: `Resets {weekday} {h}:{mm} {AM|PM}` with short weekday (`Thu`) and 12-hour local time (`12:00 AM`)

Locale is the system locale. Tests lock the English strings above.

### 10. Biome, not ESLint/Prettier

Root `biome.json` via `@biomejs/biome` `2.5.9`. Turbo tasks: `lint`, `format`, `check`, `typecheck`, `test`, `dev`, `build`. Editors and CI use Biome only.

### 11. TypeScript 5.9.3, not 7.x

Latest TypeScript (`7.0.2`) is old enough under the 7-day rule, but electron-vite 5 / Vite 8 typings still target 5.x. Pin `typescript` `5.9.3`.

### 12. Pinned versions (published on or before 2026-08-21)

Skipped newer releases: Electron 44.0.0 (2026-08-25), Turbo 2.10.12 (2026-08-25), Biome 2.5.11 (2026-08-27), TanStack Router 1.170.32 (2026-08-22), lucide-react 1.35.0 (2026-08-28), shadcn 4.19.0 (2026-08-21 after cutoff).

| Package | Version |
| --- | --- |
| `pnpm` (packageManager) | 11.22.0 |
| `turbo` | 2.10.11 |
| `electron` | 43.4.1 |
| `electron-vite` | 5.0.0 |
| `electron-builder` | 26.15.3 |
| `react` / `react-dom` | 19.2.8 |
| `typescript` | 5.9.3 |
| `vite` | 8.2.2 |
| `@vitejs/plugin-react` | 6.1.0 |
| `@biomejs/biome` | 2.5.9 |
| `@tanstack/react-router` | 1.170.31 |
| `@tanstack/router-plugin` | 1.168.34 |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 |
| `shadcn` (CLI) | 4.18.0 |
| `lucide-react` | 1.33.0 |
| `class-variance-authority` | 0.7.1 |
| `clsx` | 2.1.1 |
| `tailwind-merge` | 3.6.0 |
| `zod` | 4.4.3 |
| `electron-store` | 11.0.2 |
| `zustand` | 5.0.15 |
| `vitest` | 4.1.11 |
| `playwright` | 1.62.1 |

Settings client state (open tab, local form) MAY use zustand. Source of truth for settings is `electron-store` in main, validated with Zod from `packages/config`.

### 13. Persistence schema

`electron-store` key `capsule.settings` (versioned). Zod object: `placementPreset`, `enabledProviderIds`, `demoMode`, `pollIntervalMs`, `launchAtLogin`. Migrations: additive only; unknown keys dropped.

### 14. Tests

- `packages/dates`: relative/absolute strings.
- `packages/usage`: clamp, Claude mapping fixture, error-keeps-last-snapshot, unauthenticated ≠ 0.
- Placement: given mock `bounds`/`workArea`/Dock/Stage Manager flags, assert x/y/orientation per preset.
- `packages/hud`: Playwright screenshot of the overlay renderer with demo data vs `references/hud-reference.jpg` (layout contract; not a pixel-diff of the wallpaper).
- No network in unit tests; Anthropic/ChatGPT responses are fixtures.

### 15. Changelog, not OpenAPI

Every implemented slice appends `CHANGELOG.md`. No `openapi.json` until an HTTP server exists.

### 16. File-size and reuse rules

Source files stay ≤ 500 lines. Split overlay window, IPC, placement, and each provider into separate modules. HUD pieces are separate components. Shared widgets go in `packages/hud` or `packages/ui` before a second copy is written.

## Risks / Trade-offs

- **[Risk] Anthropic/ChatGPT usage endpoints are unofficial and can change** → Isolate URLs/headers in `packages/config`; adapters parse defensively; demo mode still ships a usable HUD; stale snapshots on failure.
- **[Risk] Dock flank and Stage Manager leftover space cannot be measured exactly from public APIs** → v1 uses workArea + defaults + named insets; visually prefer “in the empty region” over pixel-perfect Dock hugging; native helper is a follow-up.
- **[Risk] Transparent always-on-top Electron panels can steal clicks or break fullscreen** → ignore-mouse-events + pointer capture; hide on native fullscreen; `roundedCorners: false`.
- **[Risk] Visual fidelity of the metaball join** → treat the reference image as the acceptance test; iterate the SVG path before adding animation.
- **[Risk] Token leakage into renderer or logs** → usage package is main-only; preload allowlist; never log token values.
- **[Risk] Existing blog markdown confuses the repo** → do not delete in this change; README replacement happens during apply so the root describes Capsule.

## Migration Plan

1. Add monorepo scaffolding beside existing markdown posts; do not rewrite git history.
2. Ignore `node_modules`, `dist`, `out`, `.turbo` via `.gitignore`.
3. Implement demo-mode HUD first (visual acceptance), then Claude adapter, then ChatGPT, then placement presets, then settings.
4. Rollback is “don’t ship”; there is no production user data except local settings, which can be deleted by removing the electron-store file.
5. After apply, archive this change so `openspec/specs/` becomes the living spec.

## Open Questions

1. **Third provider identity.** The reference’s third icon is a geometric asterisk. v1 names it `spark` and allows a demo-only adapter. Confirm if it should be Perplexity, Grok, Gemini, or stay generic.
2. **Menu-bar extra.** Spec says the HUD is the presence (no Dock icon). A compact menu-bar percent is out of scope unless requested.
3. **Code signing.** Not in this change; electron-builder config should leave a slot for Apple Developer ID later.
4. **Multi-account.** One Claude identity and one ChatGPT identity in v1.
