import type { ProviderId, UsageSnapshot } from "@capsule/config";
import { openGolden } from "@capsule/fixtures";
import { afterAll, describe, expect, it } from "vitest";
import { mergeSnapshot } from "../merge.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";
import { claudeUsageFromCache, mapClaudeUsage } from "./claude.ts";
import { mapCodexUsage } from "./codex.ts";
import { copilotTokenFromApps, mapCopilotUsage } from "./copilot.ts";
import { cursorTokenFromHex, jwtSubject, mapCursorUsage } from "./cursor.ts";
import { grokTokenFromFile, mapGrokCredits } from "./grok.ts";

/**
 * Every case here compares a whole mapped snapshot, not the handful of fields
 * a hand-written assertion would reach for, because the Swift port has to
 * reproduce all of it. The expectations are recorded from this
 * implementation; see `openGolden`.
 */
function goldenSuite<Input, Expected>(
  path: string,
  run: (input: Input, now: Date) => Expected,
): void {
  const golden = openGolden<Input, Expected>(path);
  const now = golden.frozenNow ? new Date(golden.frozenNow) : new Date(0);

  describe(golden.about, () => {
    for (const testCase of golden.cases) {
      it(testCase.name, () => {
        const actual = run(testCase.input, now);
        expect(actual).toEqual(golden.expect(testCase, actual));
      });
    }
    afterAll(() => golden.flush());
  });
}

goldenSuite("usage/claude-mapping", (payload, now) =>
  mapClaudeUsage(payload as Parameters<typeof mapClaudeUsage>[0], now),
);

goldenSuite("usage/codex-mapping", (payload, now) =>
  mapCodexUsage(payload as Parameters<typeof mapCodexUsage>[0], now),
);

goldenSuite("usage/grok-mapping", (payload, now) =>
  mapGrokCredits(payload as Parameters<typeof mapGrokCredits>[0], now),
);

goldenSuite("usage/grok-echo-row", (payload, now) =>
  mapGrokCredits(payload as Parameters<typeof mapGrokCredits>[0], now),
);

goldenSuite("usage/cursor-mapping", (payload, now) =>
  mapCursorUsage(payload as Parameters<typeof mapCursorUsage>[0], now),
);

goldenSuite("usage/copilot-mapping", (payload, now) =>
  mapCopilotUsage(payload as Parameters<typeof mapCopilotUsage>[0], now),
);

goldenSuite("usage/claude-cache", (raw: string) => claudeUsageFromCache(raw));

goldenSuite("usage/unauthenticated", (providerId: ProviderId, now) =>
  unauthenticatedSnapshot(providerId, now),
);

goldenSuite(
  "usage/tokens-from-file",
  (input: { reader: string; raw: string }) => {
    switch (input.reader) {
      case "grok":
        return grokTokenFromFile(input.raw);
      case "copilot":
        return copilotTokenFromApps(input.raw);
      case "cursor-hex":
        return cursorTokenFromHex(input.raw);
      case "cursor-subject":
        return jwtSubject(input.raw);
      default:
        throw new Error(`unknown token reader: ${input.reader}`);
    }
  },
);

goldenSuite(
  "usage/merge",
  (input: { previous: UsageSnapshot | null; next: UsageSnapshot }) =>
    mergeSnapshot(input.previous ?? undefined, input.next),
);
