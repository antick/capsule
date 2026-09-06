# Capsule

macOS dock for Claude, Codex, and Grok.

Capsule displays Claude, Codex, and Grok usage from the existing CLI logins on this Mac. Meter hover and click open the usage card; activity notices have their own badge buttons. Demo mode uses sample numbers.

**Agent chat is suspended.** Its source code is preserved, but the app does not start its connections, register its commands, show its menu, or build its panel. Old channel setup commands exit without opening a connection. There is no settings or environment override.

## Local activity notifications

Claude Code, Codex, and Grok local session records can light up their meter while working or waiting. An explicit finished response or input request opens a connected popup with the latch's existing spring animations. Alerts group by provider, pause while hovered, and fold away after a few seconds; click the separate badge to reopen them. Meter hover and click always open usage, even with pending notifications. Numbers count unread alerts. Opening the list or hovering over its popup clears the unread count; a small dot keeps history accessible until you dismiss it. Longer lists scroll. Dismissal only clears the local notice. Answer requests in the original provider app.

General → Show notification popups is on by default. Turn it off for unread badges and pulsing provider icons without automatic popups.

This reads bounded local session logs and process metadata only. It installs no hooks and opens no agent connections. Old events do not replay on launch. Missing or stale records show an unconfirmed status; silence never counts as completion. Coverage depends on what each installed app records: Codex synchronous input requests are recognized, but approval prompts without a local event cannot be detected. See [implementation and coverage](openspec/changes/passive-activity-notices/README.md).

## Develop

Requires Node 22+, pnpm 11.22.x, and macOS.

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` starts the Electron overlay. Demo mode is optional and uses fixed sample numbers. Outside demo mode, the existing usage readers and refresh schedule are active.

Right-click the rail for Settings and Quit. Settings cover placement, providers, demo mode, and launch at login.

## Placement

- `right-edge` (default)
- `left-edge`
- `dock-flank-left` / `dock-flank-right`
- `stage-manager-top` / `stage-manager-bottom` (falls back to left-edge when Stage Manager is off)

## Stack

pnpm workspaces + Turborepo, Electron, React, TanStack Router (file-based), Tailwind, Biome. Specs live in `openspec/`.

Native notification regression check (after `pnpm build`):

```bash
CAPSULE_PLAYWRIGHT_PATH=/path/to/playwright node apps/desktop/scripts/verify-notifications.cjs
```

The check uses a temporary home directory, sample usage, and synthetic local events; account requests are blocked.
