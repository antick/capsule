import {
  COPY,
  DEFAULT_ENABLED_PROVIDER_IDS,
  PROVIDER_LABELS,
  type ProviderId,
} from "./constants.ts";
import type { UsageSnapshot } from "./usage-types.ts";

/** Menu bar in the reference HUD: Thu 27 Aug 11.22 (local) */
export const DEMO_NOW_ISO = "2026-08-27T11:22:00";

const demoNow = new Date(DEMO_NOW_ISO);
const DEMO_FETCHED_AT = demoNow.toISOString();
const SESSION_RESET_ISO = new Date(
  demoNow.getTime() + 51 * 60 * 1000,
).toISOString();
const WEEKLY_RESET_ISO = new Date("2026-09-03T00:00:00").toISOString();
const CODEX_RESET_ISO = new Date(
  demoNow.getTime() + 5 * 60 * 60 * 1000,
).toISOString();
const GROK_RESET_ISO = new Date(
  demoNow.getTime() + 7 * 60 * 60 * 1000,
).toISOString();

export function placeholderSnapshots(
  ids: readonly ProviderId[] = DEFAULT_ENABLED_PROVIDER_IDS,
  now: Date = new Date(),
): UsageSnapshot[] {
  // Nothing enabled still draws something, or the dock would vanish with no
  // way back to it — but the something is the default set, not every provider.
  const list = ids.length > 0 ? ids : DEFAULT_ENABLED_PROVIDER_IDS;
  return list.map((providerId) => ({
    providerId,
    displayName: PROVIDER_LABELS[providerId],
    iconId: providerId,
    primaryPercent: null,
    buckets: [],
    status: "unauthenticated",
    fetchedAt: now.toISOString(),
  }));
}

export const DEMO_SNAPSHOTS: UsageSnapshot[] = [
  {
    providerId: "claude",
    displayName: "Claude",
    iconId: "claude",
    primaryPercent: 73,
    status: "ok",
    fetchedAt: DEMO_FETCHED_AT,
    buckets: [
      {
        id: "current-session",
        label: COPY.currentSession,
        percentUsed: 73,
        resetsAt: SESSION_RESET_ISO,
        resetStyle: "relative",
      },
      {
        id: "all-models",
        label: COPY.allModels,
        percentUsed: 7,
        resetsAt: WEEKLY_RESET_ISO,
        resetStyle: "absolute",
      },
    ],
  },
  {
    providerId: "codex",
    displayName: "Codex",
    iconId: "codex",
    primaryPercent: 21,
    status: "ok",
    fetchedAt: DEMO_FETCHED_AT,
    buckets: [
      {
        id: "primary",
        label: COPY.fiveHourWindow,
        percentUsed: 21,
        resetsAt: CODEX_RESET_ISO,
        resetStyle: "relative",
      },
      {
        id: "secondary",
        label: COPY.weeklyWindow,
        percentUsed: 8,
        resetsAt: WEEKLY_RESET_ISO,
        resetStyle: "absolute",
      },
    ],
  },
  {
    providerId: "grok",
    displayName: "Grok",
    iconId: "grok",
    primaryPercent: 52,
    status: "ok",
    fetchedAt: DEMO_FETCHED_AT,
    buckets: [
      {
        id: "weekly",
        label: COPY.grokWeekly,
        percentUsed: 52,
        resetsAt: GROK_RESET_ISO,
        resetStyle: "relative",
      },
      {
        id: "build",
        label: COPY.grokBuild,
        percentUsed: 18,
        resetsAt: WEEKLY_RESET_ISO,
        resetStyle: "absolute",
      },
    ],
  },
];
