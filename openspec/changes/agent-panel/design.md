# Agent panel

> Historical record. Agent chat is now disabled by user request. Do not invoke it. See [suspension.md](suspension.md).

Approved in conversation: keep hover for usage and activity; click a provider to open a focusable panel attached to the latch. List individual sessions with waiting first, then working, then idle. Selecting one shows recent messages and a draft that survives closing or switching sessions.

Reuse the activity package, theme, date helpers and Electron IPC. Connections run in the main process. Only verified connected sessions accept messages. Detected sessions remain view-only. No automatic session resume, permission bypass, global configuration changes, or extra agent runs.

Codex uses its existing app-server control socket through the installed CLI proxy. Poll loaded threads and their statuses, handle provider requests, and send turn/steer with the active turn id or turn/start when idle. Command approvals can be approved once when the provider allows it and supplies the command. File edits and broader permission grants stay in Codex; the panel can decline them. A missing socket is a visible setup condition, never a reason to spawn a second copy of a running conversation.

Claude uses a local, opt-in MCP channel with a private Unix socket per channel process. User messages become channel notifications; a reply tool returns messages to Capsule. The channel is installed through setup instructions, without changing the user's Claude configuration automatically. Permission requests remain in the source app. No HTTP endpoint is needed.

Each command validates its origin and inputs. Messages are never automatically resent after an ambiguous timeout. On disconnect, disable sending, retain drafts and show the connection state. Keep transcripts in memory only and bound message and frame sizes.

Source files stay under 500 lines. Use pinned dependencies at least 7 days old if needed; prefer the installed libraries and Node built-ins. Verify protocol routing, failures, simultaneous sessions, draft preservation, keyboard focus and screen-edge placement. Live provider checks must be reported separately from simulated transport and UI checks.
