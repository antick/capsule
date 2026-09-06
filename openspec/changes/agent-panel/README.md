# Agents in the latch

Click a Claude or Codex meter, or choose **Agents** from Capsule's menu. The menu shortcut is **Command–Shift–A**. Hovering still shows usage and activity.

Choose a session to see messages. Type a follow-up and press **Command–Enter** or **Send**. Enter adds a new line. Escape closes the panel. Drafts survive switching sessions and closing the panel, until Capsule quits.

**Connected** means Capsule has a local message transport. **View only** means Capsule can detect activity but cannot send to that session. Passive Codex activity is labeled **status unconfirmed** because a recent log write does not prove the agent is still running.

## Claude Code

Open **Connection setup** in the panel and run the generated command in the project directory where you want Claude Code to work. It starts Claude Code with Capsule's MCP channel for that session. Review Claude Code's development-channel and MCP consent prompts. Capsule does not change your saved Claude settings or bypass tool permissions.

The channel uses the installed Node executable and the built `channel-entry.js` beside Capsule's main entry. Build Capsule before using that command in development. If the app is moved or upgraded, use the current command from the panel.

Claude's channel feature is a research preview. A custom channel needs the development-channel opt-in; managed organizations may disallow it. Loading an MCP server alone does not prove that Claude enabled delivery of its channel events. **Accepted by connection** means the local bridge accepted the message; Claude's reply is the confirmation that the agent received it. Claude approvals remain in Claude Code. Existing sessions without the channel remain view-only.

Messages and replies sent through Capsule appear in the panel. This is not a copy of the entire Claude terminal transcript.

## Codex

Capsule connects to the installed CLI's app-server proxy and the existing local control socket under `$CODEX_HOME/app-server-control/app-server-control.sock` (`~/.codex` by default). To connect a client that exposes a different socket, launch Capsule with `CAPSULE_CODEX_SOCKET` set to that path. The socket must belong to your user and be private.

Starting another server does not attach sessions already running elsewhere. If your Codex client does not expose a compatible control socket, its detected sessions remain view-only. Capsule never resumes a second copy of a running thread.

Active turns receive a steering message; idle loaded sessions receive a new turn. If the active turn finishes during sending, Capsule asks you to check and send again instead of silently starting another turn. Compatible stores provide recent turns; older stores use a bounded full-history read. Very large or unsupported histories may be unavailable. Ephemeral sessions remain view-only.

Codex command approval requests can be reviewed and approved once in the panel when the provider allows that decision. File edits and additional permission grants cannot be approved here because the request alone does not include a reviewable edit; continue in Codex or decline. Other unsupported interactive requests are refused with a visible note directing you to Codex. Capsule never grants permission automatically.

## Local data

There is no HTTP service. Claude channel sockets live in the private `~/.capsule/channels` directory, with one socket per channel process. The process removes its socket when it exits. Messages, connection state and drafts stay in memory. Capsule never automatically retries a message whose delivery could not be confirmed.

The new dependency is the official `@modelcontextprotocol/sdk`, pinned to `1.30.0`, released July 27, 2026. It was the latest registry version at implementation and passed the repository's seven-day minimum age rule.

See [verification.md](verification.md) for the exact checks and remaining live-provider boundary.
