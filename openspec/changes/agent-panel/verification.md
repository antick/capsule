# Agent panel verification

> Historical record. Agent chat is now disabled by user request. Do not invoke it. See [suspension.md](suspension.md).

Verified September 6, 2026, on the implementation branch.

## Workspace checks

- `pnpm test`: 242 tests pass across config (85), dates (7), usage (35), HUD (53), activity (22), and desktop (40).
- `pnpm typecheck`: all seven configured packages pass.
- `pnpm lint`: passes with one pre-existing unused-import warning in the unchanged `overlay-window.ts`.
- `pnpm build`: passes, including the separate agent renderer and standalone Claude channel entry.
- Focused checks cover exact session routing, active versus idle Codex sends, stale approvals, disconnections, transcript failures, multiple sessions, private sockets, oversized inputs, bounded history, draft/error rendering, and display-edge placement.

## Native panel

Opened the built Electron app with temporary app data and opened Agents through its native menu. Verified that the panel receives keyboard focus while the overlay remains unfocused. Verified session switching, retained drafts, duplicate-send prevention, failed-send draft retention, one-time approval routing, Escape to hide, and reopening with the draft retained. Inspected the rendered light-theme panel at its native 410 × 530 size.

The native interaction check used simulated provider data. Physical clicking of the retracting latch was not independently verified; its click callback is wired in the HUD. The native menu path was verified.

## Provider and packaging checks

- **Live Codex:** started a disposable app-server and thread in a temporary directory. A no-tools prompt completed with `CAPSULE_CONNECTION_OK`, and its assistant reply was read back. Deleted that test thread afterward. No messages were sent to the user's existing tasks. This exposed an installed-store limitation in `thread/turns/list`; the implemented fallback to bounded `thread/read` history was verified.
- **Claude transport:** initialized the real MCP SDK bridge, sent a message through its private Unix socket, observed the channel notification, called its reply tool, and verified the transcript and cleanup. Repeated against the built standalone entry and an ASAR archive with the entry and shared chunks unpacked. This proves local transport and packaging layout, not delivery through a live Claude model with development channels enabled.
- **Existing desktop sessions:** this machine did not expose the compatible Codex control socket, so attaching to its existing desktop tasks remains unverified. Claude delivery requires the user's explicit development-channel setup. Detected sessions remain view-only until a compatible connection exists.
- **Distribution:** did not sign, notarize, or launch a packaged distribution. The standalone Node bridge was launched from the unpacked ASAR layout.

## Dependency

Added only the official `@modelcontextprotocol/sdk`, pinned to `1.30.0`. Registry metadata showed it as latest, published July 27, 2026, satisfying the seven-day minimum age rule. No newer version needed to be skipped.

See [README.md](README.md) for connection setup and the meaning of delivery status.
