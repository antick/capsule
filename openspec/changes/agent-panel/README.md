# Agent chat is suspended

The user disabled this feature on September 6, 2026. Do not run channel setup commands, start provider connections, or send messages to agents.

The implementation remains in source for a future explicitly authorized review. Current builds have no Agents menu, meter-to-chat action, registered chat IPC, or chat renderer. The preserved connection manager and panel are guarded by `AGENTS.enabled: false`, with no settings or environment override. The standalone channel launcher exits immediately; it does not initialize MCP or create sockets.

Capsule's credential-based usage readers for Claude, Codex, and Grok have been removed, including saved-token reads, keychain access, token refreshes, and direct account endpoint calls. The usage display is local only: disabled readings or explicit demo data. Local passive activity monitoring does not send messages or contact providers.

The earlier [design](design.md), [implementation checklist](tasks.md), and [verification record](verification.md) describe the historical implementation, not currently enabled functionality. See [suspension.md](suspension.md) for this change.
