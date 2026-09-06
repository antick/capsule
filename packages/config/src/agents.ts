import type { AgentSession } from "./activity.ts";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface ConnectedAgent extends AgentSession {
  connection: "connected" | "view-only";
  messages: AgentMessage[];
  note: string;
  request?: { id: string; title: string; detail: string; canApprove: boolean };
}

export interface AgentPanelSnapshot {
  sessions: ConnectedAgent[];
  connections: {
    provider: "claude" | "codex";
    connected: boolean;
    detail: string;
  }[];
}

export const AGENTS = {
  panelWidth: 410,
  panelHeight: 530,
  panelGap: 8,
  pollMs: 2000,
  requestTimeoutMs: 8000,
  maxMessageLength: 16000,
  maxFrameBytes: 2 * 1024 * 1024,
  maxMessages: 80,
  maxSessions: 100,
  channelDirectory: ".capsule/channels",
  codexSocket: "app-server-control/app-server-control.sock",
  executableDirectories: [".local/bin", "/opt/homebrew/bin", "/usr/local/bin"],
  privateSocketMask: 0o077,
  codexHome: ".codex",
  channelName: "capsule",
  channelVersion: "1.0.0",
} as const;

export const AGENT_IPC = {
  open: "capsule:agents-open",
  close: "capsule:agents-close",
  snapshot: "capsule:agents-snapshot",
  get: "capsule:agents-get",
  send: "capsule:agents-send",
  setup: "capsule:agents-setup",
  select: "capsule:agents-select",
  respond: "capsule:agents-respond",
} as const;

export const AGENT_COPY = {
  loading: "Looking for agents…",
  loadFailed:
    "Could not load agents. Close and reopen this panel to try again.",
  sessionGone: "This session is no longer available. Your draft is saved.",
  filterLabel: "Filter agents",
  conversation: "Conversation",
  you: "You",
  shortcut: "⌘ Enter to send · Enter for a new line",
  setupHint:
    "Connect a session to send messages. Claude approvals stay in Claude Code; Codex command approvals can appear here.",
  setupLoading: "Loading setup…",
  setupFailed: "Setup instructions could not be loaded.",
  claudeSetup: "Run this in the terminal where you want to start Claude Code:",
  codexSetup:
    "Codex must expose its control connection. Starting a separate server does not connect existing work.",
  panelRootMissing: "agents root missing",
  title: "Agents",
  approveOnce: "Approve once",
  decline: "Decline",
  responding: "Sending your decision…",
  responseAccepted: "Decision sent",
  requestFailed:
    "Could not confirm your decision. Check the session before trying again.",
  requestBlocksSend: "Respond to the request before sending another message.",
  all: "All",
  back: "Back to agents",
  close: "Close agents",
  empty: "No running agents found",
  emptyHint: "Start Claude Code or Codex. Your sessions will appear here.",
  placeholder: "Message this session…",
  send: "Send",
  sending: "Sending…",
  accepted: "Accepted by connection",
  uncertain:
    "Delivery could not be confirmed. Check the session before retrying.",
  viewOnly: "View only",
  connected: "Connected",
  noMessages: "New messages will appear here.",
  setup: "Connection setup",
  busy: "Working",
  waiting: "Needs your attention",
  idle: "Idle",
  claudeNote:
    "Replies sent through Capsule appear here. Approvals stay in Claude Code.",
  codexNote:
    "Follow-ups go to this session. Command approvals may appear here; other requests need Codex.",
  codexEphemeral: "Ephemeral sessions must be continued in Codex.",
  historyUnavailable:
    "Recent messages could not be loaded. The session is still listed; check Codex for its full conversation.",
  codexApprovalTitle: "Codex needs permission",
  codexUnsupported: "This request needs the full Codex client. Continue there.",
  codexSetupText:
    "Capsule connects to the existing Codex app-server control socket. If your client exposes a custom socket, launch Capsule with CAPSULE_CODEX_SOCKET set to that path. It must belong to you and have private permissions. Restarting or creating a separate server does not attach existing sessions.",
  observedNote: "Activity detected. Connect this session to send messages.",
  codexUnavailable:
    "Codex control socket unavailable. Existing sessions are view only.",
  claudeUnavailable:
    "Enable the Capsule channel in Claude Code to exchange messages.",
} as const;

export function validAgentMessage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= AGENTS.maxMessageLength
  );
}
