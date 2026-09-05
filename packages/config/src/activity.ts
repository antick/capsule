import type { ProviderId } from "./constants.ts";
import { SEVERITY_COLORS } from "./constants.ts";
import type { HudTheme } from "./theme.ts";

/** What one agent session is doing right now. */
export type AgentSessionState = "busy" | "waiting" | "idle";

/**
 * One agent session, whichever tool it belongs to.
 *
 * Deliberately a display model rather than a mirror of any one tool's file
 * format: Claude Code publishes a session registry, Codex appends to rollout
 * logs, and neither shape belongs in the dock. Each monitor does its own
 * parsing and hands back this.
 */
export interface AgentSession {
  id: string;
  providerId: ProviderId;
  /** What to call it in the card. */
  name: string;
  /** The quieter second line: where it is running, or what it is doing. */
  detail: string;
  state: AgentSessionState;
  /** Set while waiting: what it wants from you. */
  waitingFor: string | null;
  /** When it entered its current state, as an ISO timestamp. */
  since: string;
}

/** Live sessions, keyed by the provider they belong to. */
export type ActivityByProvider = Partial<Record<ProviderId, AgentSession[]>>;

export type ActivityState = "working" | "waiting" | "idle";

/**
 * What the ring shows: the state of every live session, reduced to the one
 * thing worth knowing at a glance.
 */
export interface ActivitySummary {
  state: ActivityState;
  sessions: AgentSession[];
}

/**
 * Null when nothing is running, so the indicator disappears rather than
 * sitting there saying nothing. Anything blocked on you outranks anything
 * merely busy: it is the only state where the dock is asking for something.
 */
export function summarizeActivity(
  sessions: readonly AgentSession[] | undefined,
): ActivitySummary | null {
  if (!sessions || sessions.length === 0) {
    return null;
  }
  const state: ActivityState = sessions.some((s) => s.state === "waiting")
    ? "waiting"
    : sessions.some((s) => s.state === "busy")
      ? "working"
      : "idle";
  return { state, sessions: [...sessions] };
}

/** Whether any agent, for any provider, is doing something right now. */
export function anyAgentActive(activity: ActivityByProvider): boolean {
  return Object.values(activity).some((sessions) =>
    (sessions ?? []).some((s) => s.state !== "idle"),
  );
}

/**
 * White for working, deliberately: the indicator sits inside a ring whose
 * colour already means "how much of your limit is gone", and a neutral tone
 * cannot be misread as part of that scale. Waiting gets the amber band because
 * it is the one state that wants something from you.
 */
export function activityColor(state: ActivityState, theme: HudTheme): string {
  if (state === "working") {
    return theme.text;
  }
  if (state === "waiting") {
    return SEVERITY_COLORS.mid;
  }
  return theme.ringTrack;
}

/** The colour a session's own status word and ring take in the card. */
export function sessionStateColor(
  state: AgentSessionState,
  theme: HudTheme,
): string {
  if (state === "busy") {
    return SEVERITY_COLORS.low;
  }
  if (state === "waiting") {
    return SEVERITY_COLORS.mid;
  }
  return theme.textMuted;
}

/**
 * Busy and waiting sessions first, so whatever the card has to hide when the
 * list is long is what matters least.
 */
export function orderSessions(
  sessions: readonly AgentSession[],
): AgentSession[] {
  const rank = (s: AgentSession) =>
    s.state === "waiting" ? 0 : s.state === "busy" ? 1 : 2;
  return [...sessions].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    return byRank !== 0 ? byRank : b.since.localeCompare(a.since);
  });
}

/** How the agent monitors look for work, and how long they trust what they find. */
export const ACTIVITY = {
  /** How often every monitor re-reads its source. */
  pollMs: 2000,
  /** Several file events land for one state change; coalesce them. */
  watchDebounceMs: 120,
  /** Claude Code's session registry: one `<pid>.json` per running process. */
  claudeSessionsDirSegments: [".claude", "sessions"] as const,
  /**
   * How far apart a session's registered start and its process's real start
   * may be before the pid is assumed to have been handed to something else.
   */
  pidReuseToleranceMs: 5 * 60_000,
  /** Codex's thread index, which names the rollout each thread appends to. */
  codexStateDbSegments: [".codex", "state_5.sqlite"] as const,
  /** The desktop app's own thread catalogue; it writes no rollouts. */
  codexDesktopDbSegments: [".codex", "sqlite", "codex-dev.db"] as const,
  /** Where the CLI writes rollouts, by year, month and day. */
  codexSessionsDirSegments: [".codex", "sessions"] as const,
  /**
   * Codex publishes no status field, only a log it appends to while a turn
   * runs. A rollout written this recently means work is happening now; older
   * is a finished turn, and reporting it as work would be a guess dressed as
   * a fact.
   */
  codexStaleAfterMs: 8000,
  /** How many of the newest day folders are worth looking in for a rollout. */
  codexRecentDays: 2,
} as const;

/**
 * Refreshing usage when nobody is working only spends rate limit on numbers
 * that cannot have moved. Polling drops to this while every agent is idle.
 */
export const IDLE_POLL_INTERVAL_MS = 5 * 60_000;

/**
 * How long to wait after a 429. The server's own hint is honoured only as a
 * floor-raiser: it answers `Retry-After: 0`, and obeying that literally means
 * retrying immediately, which is what keeps you rate limited. So the wait
 * starts at a minute and doubles for each 429 in a row, capped so it always
 * recovers on its own.
 */
export const BACKOFF = {
  floorMs: 60_000,
  ceilingMs: 15 * 60_000,
  maxDoublings: 4,
} as const;
