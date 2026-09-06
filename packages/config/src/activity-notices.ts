import type { ProviderId } from "./constants.ts";

export interface ActivityNotice {
  id: string;
  sessionId: string;
  providerId: ProviderId;
  title: string;
  kind: "completed" | "waiting";
  at: string;
}

export const ACTIVITY_NOTICES = {
  waitingColor: { dark: "#e4b665", light: "#8a5615" },
  completedColor: { dark: "#74c6a3", light: "#236c4b" },
  visibleMs: 6500,
  maxVisible: 3,
  maxPending: 20,
  maxSessions: 100,
  tailBytes: 256 * 1024,
  maxRecordBytes: 256 * 1024,
  maxTitleLength: 120,
  maxSeen: 1000,
  grokRegistry: [".grok", "active_sessions.json"] as const,
  grokSessions: [".grok", "sessions"] as const,
  claudeProjects: [".claude", "projects"] as const,
  eventsFile: "events.jsonl",
  statusUnknown: "Status unconfirmed",
  localActivity: "Local activity",
  localWorking: "Working · local task event",
  localWaiting: "Waiting for your input",
} as const;

export const NOTICE_IPC = {
  get: "capsule:get-activity-notices",
  changed: "capsule:activity-notices",
  dismiss: "capsule:dismiss-activity-notice",
} as const;
