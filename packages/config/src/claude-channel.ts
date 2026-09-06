export const CLAUDE_CHANNEL = {
  directoryMode: 0o700,
  socketMode: 0o600,
  maxSocketPathBytes: 103,
  notification: "notifications/claude/channel",
  replyTool: "reply",
  instructions:
    "Messages from Capsule arrive through this channel. Use the reply tool to send your response back to Capsule. Tool approvals stay in Claude Code.",
  replyDescription:
    "Send a response to the Capsule conversation for this session",
  replyAccepted: "Reply sent to Capsule",
  note: "Messages are accepted by the connection; delivery requires this channel to be enabled in Claude Code. Replies through Capsule appear here. Approvals stay in Claude Code.",
  detail: "Claude Code · Capsule channel",
} as const;
