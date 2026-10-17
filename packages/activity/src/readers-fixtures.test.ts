import type { ProviderId, TokenUsageByProvider } from "@capsule/config";
import { goldenSuite } from "@capsule/fixtures/vitest";
import { afterAll, beforeAll, vi } from "vitest";
import { readClaudeSessions } from "./claude.ts";
import { readCodexSessions } from "./codex.ts";
import { readGrokSessions } from "./grok.ts";
import type { ActivityHost } from "./host.ts";
import { createActivityMonitor } from "./monitor.ts";
import {
  claudeRowTokens,
  codexRowTokens,
  createTokenScanner,
  type LogFile,
  scanTokenLogs,
  type TokenFileCache,
  type TokenRow,
  type TokenScanHost,
} from "./tokens.ts";

/**
 * The activity readers over a stub machine world, recording what they found
 * and every query and tail read they made, so a port has to look in the same
 * places with the same questions.
 */

type Line = string | { repeat: string; count: number };
interface Log {
  path: string;
  size: number;
  modifiedMs: number;
  lines: Line[] | null;
}
interface World {
  home: string;
  now: string;
  files: Record<string, string>;
  dirs: Record<string, string[]>;
  modified: Record<string, string>;
  processes: Record<string, string | null>;
  queries: Record<string, string[][]>;
  readTail: boolean;
  logs?: Log[];
  cache?: TokenFileCache;
  enabled?: ProviderId[];
  scan?: { root: string; parser: "claude" | "codex"; cache: TokenFileCache };
  steps?: (
    | { op: "rescan" }
    | { op: "kill"; pid: number }
    | { op: "addLog"; log: Log }
  )[];
}

const expand = (line: Line): string =>
  typeof line === "string" ? line : line.repeat.repeat(line.count);

function host(world: World) {
  const queries: { db: string; sql: string }[] = [];
  const tails: string[] = [];
  const reads: string[] = [];
  const logs = [...(world.logs ?? [])];
  const processes = { ...world.processes };
  let saved: TokenFileCache | null = null;
  const stub: TokenScanHost = {
    now: () => new Date(world.now),
    homeDir: () => world.home,
    listDir: async (dir) => world.dirs[dir] ?? [],
    readFile: async (path) => world.files[path] ?? null,
    modifiedAt: async (path) =>
      world.modified[path] ? new Date(world.modified[path]) : null,
    isProcessAlive: async (pid) => String(pid) in processes,
    processStartedAt: async (pid) => {
      const when = processes[String(pid)];
      return when ? new Date(when) : null;
    },
    query: async (db, sql) => {
      queries.push({ db, sql });
      return world.queries[db] ?? [];
    },
    interval: () => () => undefined,
    ...(world.readTail
      ? {
          readTail: async (path: string, bytes: number) => {
            tails.push(path);
            const content = world.files[path];
            return content === undefined ? null : content.slice(-bytes);
          },
        }
      : {}),
    walk: async (dir): Promise<LogFile[]> =>
      logs
        .filter((log) => log.path.startsWith(`${dir}/`))
        .map(({ path, size, modifiedMs }) => ({ path, size, modifiedMs })),
    eachLine: async (path, onLine) => {
      reads.push(path);
      const log = logs.find((item) => item.path === path);
      if (!log || log.lines === null) return false;
      for (const line of log.lines) onLine(expand(line));
      return true;
    },
    loadTokenCache: () => structuredClone(world.cache ?? {}),
    saveTokenCache: (cache) => {
      saved = structuredClone(cache);
    },
  };
  return {
    stub,
    record: { queries, tails, reads },
    logs,
    processes,
    saved: () => saved,
  };
}

beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterAll(() => {
  vi.restoreAllMocks();
});

for (const [path, read] of [
  ["activity/claude-reader", readClaudeSessions],
  ["activity/codex-reader", readCodexSessions],
  ["activity/grok-reader", readGrokSessions],
] as const) {
  goldenSuite(path, async (world: World) => {
    const { stub, record } = host(world);
    const sessions = await read(stub as ActivityHost);
    return { sessions, queries: record.queries, tails: record.tails };
  });
}

goldenSuite("activity/token-scan", async (world: World) => {
  const { stub, record } = host(world);
  const scan = world.scan ?? {
    root: "/",
    parser: "claude" as const,
    cache: {},
  };
  const cache = structuredClone(scan.cache);
  const parser = (): ((row: unknown) => TokenRow | null) => {
    if (scan.parser === "claude") return claudeRowTokens;
    const state = { previous: 0 };
    return (row) => codexRowTokens(row, state);
  };
  const { days, touched } = await scanTokenLogs(stub, {
    root: scan.root,
    cache,
    now: new Date(world.now),
    parser,
  });
  return { days, touched: [...touched], read: record.reads, cache };
});

goldenSuite("activity/token-scanner", async (world: World) => {
  const { stub, record, logs, saved } = host(world);
  let published: TokenUsageByProvider | null = null;
  const scanner = createTokenScanner({
    host: stub,
    getEnabled: () => world.enabled ?? [],
    onChange: (tokens) => {
      published = structuredClone(tokens);
    },
  });
  const after = [];
  for (const step of world.steps ?? []) {
    published = null;
    record.reads.length = 0;
    if (step.op === "addLog") logs.push(step.log);
    if (step.op === "rescan") await scanner.rescan();
    after.push({
      op: step.op,
      published,
      tokens: scanner.getTokens(),
      read: [...record.reads],
      saved: saved(),
    });
  }
  return after;
});

goldenSuite("activity/monitor", async (world: World) => {
  const { stub, processes } = host(world);
  let published: unknown = null;
  const monitor = createActivityMonitor({
    host: stub,
    getEnabled: () => world.enabled ?? [],
    onChange: (activity) => {
      published = structuredClone(activity);
    },
  });
  const after = [];
  for (const step of world.steps ?? []) {
    published = null;
    if (step.op === "kill") delete processes[String(step.pid)];
    if (step.op === "rescan") await monitor.rescan();
    after.push({
      op: step.op,
      published,
      activity: monitor.getActivity(),
      busy: monitor.isBusy(),
    });
  }
  return after;
});
