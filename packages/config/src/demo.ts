import { COPY } from "./constants.ts";
import type { UsageSnapshot } from "./usage-types.ts";

/** Menu bar in the reference HUD: Thu 27 Aug 11.22 (local) */
export const DEMO_NOW_ISO = "2026-08-27T11:22:00";

const demoNow = new Date(DEMO_NOW_ISO);
const DEMO_FETCHED_AT = demoNow.toISOString();
const SESSION_RESET_ISO = new Date(
  demoNow.getTime() + 51 * 60 * 1000,
).toISOString();
const WEEKLY_RESET_ISO = new Date("2026-09-03T00:00:00").toISOString();
const CHATGPT_RESET_ISO = new Date(
  demoNow.getTime() + 5 * 60 * 60 * 1000,
).toISOString();
const SPARK_RESET_ISO = new Date(
  demoNow.getTime() + 7 * 60 * 60 * 1000,
).toISOString();

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
    providerId: "chatgpt",
    displayName: "ChatGPT",
    iconId: "chatgpt",
    primaryPercent: 21,
    status: "ok",
    fetchedAt: DEMO_FETCHED_AT,
    buckets: [
      {
        id: "primary",
        label: COPY.chatgptPrimary,
        percentUsed: 21,
        resetsAt: CHATGPT_RESET_ISO,
        resetStyle: "relative",
      },
      {
        id: "secondary",
        label: COPY.chatgptSecondary,
        percentUsed: 8,
        resetsAt: WEEKLY_RESET_ISO,
        resetStyle: "absolute",
      },
    ],
  },
  {
    providerId: "spark",
    displayName: "Spark",
    iconId: "spark",
    primaryPercent: 52,
    status: "ok",
    fetchedAt: DEMO_FETCHED_AT,
    buckets: [
      {
        id: "primary",
        label: COPY.sparkPrimary,
        percentUsed: 52,
        resetsAt: SPARK_RESET_ISO,
        resetStyle: "relative",
      },
      {
        id: "weekly",
        label: COPY.sparkSecondary,
        percentUsed: 18,
        resetsAt: WEEKLY_RESET_ISO,
        resetStyle: "absolute",
      },
    ],
  },
];
