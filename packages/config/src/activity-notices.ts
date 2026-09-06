import type { ProviderId } from "./constants.ts";

export interface ActivityNotice {
  id: string;
  sessionId: string;
  providerId: ProviderId;
  title: string;
  kind: "completed" | "waiting";
  at: string;
  read?: boolean;
  summary?: string;
}

export const ACTIVITY_NOTICES = {
  waitingColor: { dark: "#e4b665", light: "#8a5615" },
  completedColor: { dark: "#74c6a3", light: "#236c4b" },
  visibleMs: 6500,
  readDelayMs: 1000,
  maxEventAgeMs: 60_000,
  activeEvidenceMs: 120_000,
  maxSummaryLength: 160,
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
  grokSummaryFile: "summary.json",
  statusUnknown: "Status unconfirmed",
  localActivity: "Local activity",
  localWorking: "Working · local task event",
  localWaiting: "Waiting for your input",
} as const;

export const NOTICE_IPC = {
  get: "capsule:get-activity-notices",
  changed: "capsule:activity-notices",
  dismiss: "capsule:dismiss-activity-notice",
  read: "capsule:read-activity-notices",
} as const;

export const ACTIVITY_NOTICE_COPY = {
  noticeCompletedShort: "Completed",
  sessionUnknown: "Status unavailable",
  notificationPopups: "Show notification popups",
  notificationPopupsHint:
    "Open a popup for new activity. When off, an animated provider icon and unread count let you know.",
  noticeHistory: "Activity history",
  noticeReadMark: "·",
  noticeTitle: "Activity",
  noticeCompleted: "Task completed",
  noticeWaiting: "Needs input",
  noticeDismiss: "Dismiss notification",
  noticeMore: "more",
  noticeWaitingSuffix: "need input",
  activityTitleSuffix: " activity",
  activityEmpty: "No active sessions",
  activitySessionsSuffix: " sessions",
  activityWorkingSuffix: " working",
} as const;
