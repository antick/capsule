import { join } from "node:path";
import {
  dayKey,
  type ProviderId,
  startOfDay,
  TOKENS,
  type TokenUsage,
  type TokenUsageByProvider,
} from "@capsule/config";
import type { ActivityHost } from "./host.ts";

/** A file the scanner might read, as the walk describes it. */
export interface LogFile {
  path: string;
  size: number;
  modifiedMs: number;
}

/**
 * What the token scanner needs beyond the activity host: a way to list a tree
 * with sizes and dates without reading anything, a way to read a file one
 * line at a time without holding it in memory, and somewhere to keep what it
 * worked out last time.
 */
export interface TokenScanHost extends ActivityHost {
  walk: (dir: string) => Promise<LogFile[]>;
  /** Feeds every line to `onLine`; resolves false if the file could not be read. */
  eachLine: (path: string, onLine: (line: string) => void) => Promise<boolean>;
  loadTokenCache?: () => TokenFileCache;
  saveTokenCache?: (cache: TokenFileCache) => void;
}

/** Tokens per local day, keyed "YYYY-MM-DD". */
export type DayHistogram = Record<string, number>;

export interface TokenFileEntry {
  size: number;
  modifiedMs: number;
  days: DayHistogram;
}

/**
 * Per-file totals, remembered by size and date. Session logs are appended to,
 * never rewritten, so an unchanged size and date means unchanged contents —
 * and a launch skips re-reading gigabytes of history that cannot have moved.
 */
export type TokenFileCache = Record<string, TokenFileEntry>;

export interface TokenRow {
  at: Date;
  tokens: number;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function when(value: unknown): Date | null {
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 1e11 ? value : value * 1000);
  }
  return null;
}

/**
 * A Claude Code transcript row: each assistant message carries the usage the
 * API billed for it. Cache reads and writes are tokens too, so they count.
 */
export function claudeRowTokens(row: unknown): TokenRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const record = row as { timestamp?: unknown; message?: { usage?: unknown } };
  const usage = record.message?.usage as Record<string, unknown> | undefined;
  const at = when(record.timestamp);
  if (!usage || !at) {
    return null;
  }
  const tokens =
    num(usage.input_tokens) +
    num(usage.cache_read_input_tokens) +
    num(usage.cache_creation_input_tokens) +
    num(usage.output_tokens);
  return tokens > 0 ? { at, tokens } : null;
}

/**
 * A Codex rollout reports a running total each turn rather than a delta, so
 * the previous total has to be carried along. A total that goes down is a new
 * thread in the same file; it counts from there.
 */
export function codexRowTokens(
  row: unknown,
  state: { previous: number },
): TokenRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const record = row as {
    timestamp?: unknown;
    payload?: { type?: unknown; info?: { total_token_usage?: unknown } };
  };
  if (record.payload?.type !== "token_count") {
    return null;
  }
  const total = record.payload.info?.total_token_usage as
    | Record<string, unknown>
    | undefined;
  const at = when(record.timestamp);
  if (!total || !at) {
    return null;
  }
  const cumulative = num(total.input_tokens) + num(total.output_tokens);
  const delta =
    cumulative >= state.previous ? cumulative - state.previous : cumulative;
  state.previous = cumulative;
  return delta > 0 ? { at, tokens: delta } : null;
}

/** Today's and the month's totals from a histogram, as of `now`. */
export function histogramTotals(
  days: DayHistogram,
  now: Date,
): { today: number; month: number } {
  const today = dayKey(now);
  const floor = dayKey(startOfDay(now, TOKENS.historyDays - 1));
  let month = 0;
  for (const [day, tokens] of Object.entries(days)) {
    if (day >= floor && day <= today) {
      month += tokens;
    }
  }
  return { today: days[today] ?? 0, month };
}

/** Reads one file into a histogram of the window's days. */
async function histogramOf(
  host: TokenScanHost,
  file: LogFile,
  floorMs: number,
  parse: (row: unknown) => TokenRow | null,
): Promise<DayHistogram | null> {
  const days: DayHistogram = {};
  const ok = await host.eachLine(file.path, (line) => {
    if (line.length === 0 || line.length > TOKENS.maxLineBytes) {
      return;
    }
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      return;
    }
    const hit = parse(row);
    if (!hit || hit.at.getTime() < floorMs) {
      return;
    }
    const key = dayKey(hit.at);
    days[key] = (days[key] ?? 0) + hit.tokens;
  });
  return ok ? days : null;
}

/**
 * Totals for one provider's logs, reading only files that changed since last
 * time and only rows inside the window. Files last written before the window
 * opened cannot hold anything that counts, so they are not opened at all.
 */
export async function scanTokenLogs(
  host: TokenScanHost,
  input: {
    root: string;
    cache: TokenFileCache;
    now: Date;
    parser: () => (row: unknown) => TokenRow | null;
  },
): Promise<{ days: DayHistogram; touched: Set<string> }> {
  const floorMs = startOfDay(input.now, TOKENS.historyDays - 1).getTime();
  const days: DayHistogram = {};
  const touched = new Set<string>();
  for (const file of await host.walk(input.root)) {
    if (!file.path.endsWith(".jsonl")) {
      continue;
    }
    touched.add(file.path);
    const known = input.cache[file.path];
    let entry = known;
    if (
      !known ||
      known.size !== file.size ||
      known.modifiedMs !== file.modifiedMs
    ) {
      if (file.modifiedMs < floorMs) {
        entry = { size: file.size, modifiedMs: file.modifiedMs, days: {} };
      } else {
        const read = await histogramOf(host, file, floorMs, input.parser());
        if (!read) {
          continue;
        }
        entry = { size: file.size, modifiedMs: file.modifiedMs, days: read };
      }
      input.cache[file.path] = entry;
    }
    for (const [day, tokens] of Object.entries(entry?.days ?? {})) {
      days[day] = (days[day] ?? 0) + tokens;
    }
  }
  return { days, touched };
}

/** Forgets files that are gone, then the oldest, so the cache stays bounded. */
export function pruneTokenCache(
  cache: TokenFileCache,
  keep: Set<string>,
): TokenFileCache {
  const entries = Object.entries(cache).filter(([path]) => keep.has(path));
  entries.sort((a, b) => b[1].modifiedMs - a[1].modifiedMs);
  return Object.fromEntries(entries.slice(0, TOKENS.maxCacheEntries));
}

export interface TokenScanner {
  start: () => void;
  stop: () => void;
  rescan: () => Promise<void>;
  getTokens: () => TokenUsageByProvider;
}

const SOURCES: Partial<
  Record<
    ProviderId,
    {
      segments: readonly string[];
      parser: () => (row: unknown) => TokenRow | null;
    }
  >
> = {
  claude: {
    segments: TOKENS.claudeProjectsDirSegments,
    parser: () => claudeRowTokens,
  },
  codex: {
    segments: TOKENS.codexSessionsDirSegments,
    parser: () => {
      const state = { previous: 0 };
      return (row: unknown) => codexRowTokens(row, state);
    },
  },
};

/**
 * Counts the tokens each provider's agents have got through, from the logs
 * they keep locally, and says so whenever the answer changes.
 */
export function createTokenScanner(options: {
  host: TokenScanHost;
  getEnabled: () => readonly ProviderId[];
  onChange: (tokens: TokenUsageByProvider) => void;
}): TokenScanner {
  let tokens: TokenUsageByProvider = {};
  let cache: TokenFileCache = options.host.loadTokenCache?.() ?? {};
  let stop: (() => void) | null = null;
  let inFlight: Promise<void> | null = null;

  const rescan = (): Promise<void> => {
    if (inFlight) {
      return inFlight;
    }
    inFlight = (async () => {
      const enabled = new Set(options.getEnabled());
      const now = options.host.now();
      const next: TokenUsageByProvider = {};
      const keep = new Set<string>();
      for (const [id, source] of Object.entries(SOURCES) as Array<
        [ProviderId, NonNullable<(typeof SOURCES)[ProviderId]>]
      >) {
        if (!enabled.has(id)) {
          continue;
        }
        try {
          const { days, touched } = await scanTokenLogs(options.host, {
            root: join(options.host.homeDir(), ...source.segments),
            cache,
            now,
            parser: source.parser,
          });
          for (const path of touched) {
            keep.add(path);
          }
          const totals = histogramTotals(days, now);
          if (totals.month > 0) {
            const usage: TokenUsage = {
              providerId: id,
              todayTokens: totals.today,
              monthTokens: totals.month,
              scannedAt: now.toISOString(),
            };
            next[id] = usage;
          }
        } catch (error) {
          console.warn(
            `Capsule ${id} token scan failed`,
            error instanceof Error ? error.message : error,
          );
        }
      }
      cache = pruneTokenCache(cache, keep);
      options.host.saveTokenCache?.(cache);
      const changed = (
        Object.keys({ ...tokens, ...next }) as ProviderId[]
      ).some(
        (id) =>
          tokens[id]?.todayTokens !== next[id]?.todayTokens ||
          tokens[id]?.monthTokens !== next[id]?.monthTokens,
      );
      if (changed) {
        tokens = next;
        options.onChange(tokens);
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    start: () => {
      stop?.();
      stop = options.host.interval(TOKENS.scanIntervalMs, () => {
        void rescan();
      });
      void rescan();
    },
    stop: () => {
      stop?.();
      stop = null;
    },
    rescan,
    getTokens: () => tokens,
  };
}
