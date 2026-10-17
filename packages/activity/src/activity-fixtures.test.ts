import type {
  ActivityByProvider,
  ActivityNotice,
  AgentSession,
} from "@capsule/config";
import { goldenSuite } from "@capsule/fixtures/vitest";
import { parseClaudeSession, parseProcStart } from "./claude.ts";
import { type CodexCandidate, codexSessionFrom } from "./codex.ts";
import { applyLocalEvents } from "./local-events.ts";
import { createNoticeTracker } from "./notices.ts";
import {
  claudeRowTokens,
  codexRowTokens,
  type DayHistogram,
  histogramTotals,
  pruneTokenCache,
  type TokenFileCache,
} from "./tokens.ts";

/**
 * Passive activity — registry parsing, local event evidence, the notice
 * tracker and token counting — recorded from this implementation and read by
 * the Swift port. Everything here is a pure function of its input; reading
 * the files and processes it comes from stays in the inline tests.
 */

goldenSuite("activity/claude-session", (raw: unknown, now) =>
  parseClaudeSession(raw, now),
);

goldenSuite("activity/proc-start", (text: string) => parseProcStart(text));

goldenSuite(
  "activity/codex-session",
  (candidates: { id: string; name: string; at: string }[], now) =>
    codexSessionFrom(
      candidates.map(
        (item): CodexCandidate => ({ ...item, at: new Date(item.at) }),
      ),
      now,
    ),
);

goldenSuite(
  "activity/local-events",
  (input: { session: AgentSession; raw: string | null }) =>
    applyLocalEvents(input.session, input.raw),
);

type TrackerStep =
  | { op: "update"; activity: ActivityByProvider; now?: string }
  | { op: "markRead"; indexes: number[] }
  | { op: "dismiss"; index: number };

/** Replays the steps and records the notices after each one. */
goldenSuite(
  "activity/notice-tracker",
  (input: { startedAt: string; steps: TrackerStep[] }) => {
    const tracker = createNoticeTracker(new Date(input.startedAt));
    const idAt = (index: number) => tracker.get()[index]?.id ?? "";
    return input.steps.map((step): ActivityNotice[] => {
      if (step.op === "update") {
        return tracker.update(
          step.activity,
          step.now ? new Date(step.now) : undefined,
        );
      }
      if (step.op === "markRead") {
        return tracker.markRead(step.indexes.map(idAt));
      }
      return tracker.dismiss(idAt(step.index));
    });
  },
);

goldenSuite("activity/claude-row-tokens", (row: unknown) =>
  claudeRowTokens(row),
);

goldenSuite("activity/codex-row-tokens", (rows: unknown[]) => {
  const state = { previous: 0 };
  return rows.map((row) => codexRowTokens(row, state));
});

goldenSuite(
  "activity/histogram-totals",
  (input: { now: string; days: DayHistogram }) =>
    histogramTotals(input.days, new Date(input.now)),
);

/** As ordered entries: the order is the point, and JSON objects lose it. */
goldenSuite(
  "activity/prune-token-cache",
  (input: { cache: TokenFileCache; keep: string[] }) =>
    Object.entries(pruneTokenCache(input.cache, new Set(input.keep))),
);
