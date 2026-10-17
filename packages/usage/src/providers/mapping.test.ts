import type { ProviderId, UsageSnapshot } from "@capsule/config";
import { goldenSuite } from "@capsule/fixtures/vitest";
import { mergeSnapshot } from "../merge.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";
import { claudeUsageFromCache, mapClaudeUsage } from "./claude.ts";
import { mapCodexUsage } from "./codex.ts";
import { copilotTokenFromApps, mapCopilotUsage } from "./copilot.ts";
import { cursorTokenFromHex, jwtSubject, mapCursorUsage } from "./cursor.ts";
import { grokTokenFromFile, mapGrokCredits } from "./grok.ts";

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
