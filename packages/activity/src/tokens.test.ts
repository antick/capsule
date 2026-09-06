import { describe, expect, it, vi } from "vitest";
import type { ActivityHost } from "./host.ts";
import {
  claudeRowTokens,
  codexRowTokens,
  createTokenScanner,
  histogramTotals,
  pruneTokenCache,
  scanTokenLogs,
  type TokenFileCache,
  type TokenScanHost,
} from "./tokens.ts";

const now = new Date(2026, 8, 6, 12, 0, 0);
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number, hour = 9) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, hour);

function claudeLine(at: Date, tokens: number): string {
  return JSON.stringify({
    timestamp: iso(at),
    message: { usage: { input_tokens: tokens, output_tokens: 0 } },
  });
}

function codexLine(at: Date, cumulative: number): string {
  return JSON.stringify({
    timestamp: iso(at),
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { input_tokens: cumulative, output_tokens: 0 },
      },
    },
  });
}

function fakeHost(
  files: Record<string, { lines: string[]; modified: Date }>,
): TokenScanHost {
  const base: ActivityHost = {
    now: () => now,
    homeDir: () => "/home",
    listDir: () => Promise.resolve([]),
    readFile: () => Promise.resolve(null),
    modifiedAt: () => Promise.resolve(null),
    isProcessAlive: () => Promise.resolve(true),
    processStartedAt: () => Promise.resolve(null),
    query: () => Promise.resolve([]),
    interval: () => () => undefined,
  };
  return {
    ...base,
    walk: (dir) =>
      Promise.resolve(
        Object.entries(files)
          .filter(([path]) => path.startsWith(dir))
          .map(([path, file]) => ({
            path,
            size: file.lines.join("\n").length,
            modifiedMs: file.modified.getTime(),
          })),
      ),
    eachLine: (path, onLine) => {
      const file = files[path];
      if (!file) {
        return Promise.resolve(false);
      }
      for (const line of file.lines) {
        onLine(line);
      }
      return Promise.resolve(true);
    },
  };
}

describe("row parsers", () => {
  it("sums every kind of Claude token and ignores rows without usage", () => {
    expect(
      claudeRowTokens({
        timestamp: iso(now),
        message: {
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 5,
            output_tokens: 20,
          },
        },
      })?.tokens,
    ).toBe(135);
    expect(claudeRowTokens({ timestamp: iso(now), type: "user" })).toBeNull();
    expect(claudeRowTokens("nope")).toBeNull();
  });

  it("turns Codex running totals into deltas and restarts on a new thread", () => {
    const state = { previous: 0 };
    expect(codexRowTokens(JSON.parse(codexLine(now, 100)), state)?.tokens).toBe(
      100,
    );
    expect(codexRowTokens(JSON.parse(codexLine(now, 250)), state)?.tokens).toBe(
      150,
    );
    expect(codexRowTokens(JSON.parse(codexLine(now, 250)), state)).toBeNull();
    expect(codexRowTokens(JSON.parse(codexLine(now, 40)), state)?.tokens).toBe(
      40,
    );
    expect(
      codexRowTokens(
        { timestamp: iso(now), payload: { type: "other" } },
        state,
      ),
    ).toBeNull();
  });
});

describe("scanTokenLogs", () => {
  it("counts today and the month, skips files older than the window, and reuses unchanged files", async () => {
    const files = {
      "/home/.claude/projects/a/today.jsonl": {
        lines: [claudeLine(now, 10), claudeLine(daysAgo(1), 20)],
        modified: now,
      },
      "/home/.claude/projects/a/old.jsonl": {
        lines: [claudeLine(daysAgo(40), 999)],
        modified: daysAgo(40),
      },
      "/home/.claude/projects/a/edge.jsonl": {
        lines: [claudeLine(daysAgo(29), 5), claudeLine(daysAgo(30), 7)],
        modified: daysAgo(29),
      },
      "/home/.claude/projects/notes.txt": { lines: ["x"], modified: now },
    };
    const host = fakeHost(files);
    const eachLine = vi.spyOn(host, "eachLine");
    const cache: TokenFileCache = {};
    const first = await scanTokenLogs(host, {
      root: "/home/.claude/projects",
      cache,
      now,
      parser: () => claudeRowTokens,
    });
    const totals = histogramTotals(first.days, now);
    expect(totals.today).toBe(10);
    // Today, yesterday, and the 29-days-ago row; the 30-days-ago row is out.
    expect(totals.month).toBe(35);
    // The forty-day-old file was never opened.
    expect(eachLine).toHaveBeenCalledTimes(2);
    expect(Object.keys(cache)).toHaveLength(3);

    eachLine.mockClear();
    const second = await scanTokenLogs(host, {
      root: "/home/.claude/projects",
      cache,
      now,
      parser: () => claudeRowTokens,
    });
    expect(eachLine).not.toHaveBeenCalled();
    expect(histogramTotals(second.days, now)).toEqual(totals);
  });

  it("forgets files that are gone", () => {
    const cache: TokenFileCache = {
      a: { size: 1, modifiedMs: 1, days: {} },
      b: { size: 1, modifiedMs: 2, days: {} },
    };
    expect(Object.keys(pruneTokenCache(cache, new Set(["b"])))).toEqual(["b"]);
  });
});

describe("createTokenScanner", () => {
  it("reports per provider, only when the numbers change, and persists its cache", async () => {
    const saved: TokenFileCache[] = [];
    const host = {
      ...fakeHost({
        "/home/.claude/projects/p/s.jsonl": {
          lines: [claudeLine(now, 1200)],
          modified: now,
        },
        "/home/.codex/sessions/2026/09/06/rollout.jsonl": {
          lines: [codexLine(daysAgo(2), 500), codexLine(now, 800)],
          modified: now,
        },
      }),
      saveTokenCache: (cache: TokenFileCache) => {
        saved.push(cache);
      },
    };
    const onChange = vi.fn();
    const scanner = createTokenScanner({
      host,
      getEnabled: () => ["claude", "codex"],
      onChange,
    });
    await scanner.rescan();
    await scanner.rescan();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(scanner.getTokens().claude).toMatchObject({
      todayTokens: 1200,
      monthTokens: 1200,
    });
    expect(scanner.getTokens().codex).toMatchObject({
      todayTokens: 300,
      monthTokens: 800,
    });
    expect(saved.length).toBe(2);
    expect(Object.keys(saved[0] ?? {})).toHaveLength(2);
  });

  it("leaves out providers that are switched off", async () => {
    const scanner = createTokenScanner({
      host: fakeHost({
        "/home/.claude/projects/p/s.jsonl": {
          lines: [claudeLine(now, 5)],
          modified: now,
        },
      }),
      getEnabled: () => ["codex"],
      onChange: () => undefined,
    });
    await scanner.rescan();
    expect(scanner.getTokens()).toEqual({});
  });
});
