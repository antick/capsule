# Agent panel implementation plan

> Historical record. Agent chat is now disabled by user request. Do not invoke it. See [suspension.md](suspension.md).

**Goal:** View and message connected Claude Code and Codex sessions from the latch.
**Architecture:** Existing activity readers plus main-process connections, exposed through a narrow preload bridge to a focusable panel.
**Stack:** Electron, React, TypeScript, Node built-ins, existing Vitest.
**Spec:** [design.md](design.md)

## Tasks

- [x] Connection proof and transports: inspect installed protocols; implement bounded JSON-line RPC, Codex proxy and Claude channel. Test reply routing, concurrent sessions, disconnect and oversized input. No messages to the user's existing tasks during checks.
- [x] Shared panel contract: `ConnectedAgent`, `AgentMessage`, `AgentPanelSnapshot`, shared limits/copy, `validAgentMessage`. Main owns target routing; renderer supplies only session id and text.
- [x] Panel UI: reusable session list and conversation, source-filter buttons, connection setup, preserved drafts, sending/error feedback, accessible controls and existing theme.
- [x] Electron integration: separate focusable window placed beside the clicked meter and clamped to the display work area; IPC sender validation; hide on Escape; keep the existing overlay passive.
- [x] Verification: focused transport/placement/UI checks, workspace tests, typecheck, lint and build. Inspect the actual rendered panel, record live-provider limits, update changelog and auto-commit only task changes.

## Decisions

- Work on a dedicated feature branch in the clean user checkout so the result is available in their running project.
- Claude channel setup stays explicit because its development-channel consent belongs to Claude Code. Existing terminal and desktop sessions stay view-only until connected.
- Claude permissions remain in Claude Code. Codex command approvals can be approved once when fully shown and allowed by the provider; file edits and broader grants stay in Codex. No approval bypass controls.
