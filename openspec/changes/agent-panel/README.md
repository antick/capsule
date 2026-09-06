# Agent chat is suspended

The user disabled this feature on September 6, 2026. Do not run channel setup commands, start provider connections, or send messages to agents.

The implementation remains in source for a future explicitly authorized review. Current builds have no Agents menu, meter-to-chat action, registered chat IPC, or chat renderer. The preserved connection manager and panel are guarded by `AGENTS.enabled: false`, with no settings or environment override. The standalone channel launcher exits immediately; it does not initialize MCP or create sockets.

The user clarified that the suspension applies to chat only. Capsule's pre-existing usage readers, percentage display, and refresh behavior are restored. Local activity notifications remain additive; they do not send messages or start agent connections.

The earlier [design](design.md), [implementation checklist](tasks.md), and [verification record](verification.md) describe the historical implementation, not currently enabled functionality. See [suspension.md](suspension.md) for this change.
