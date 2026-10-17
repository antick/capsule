import {
  defaultSettings,
  PROVIDER_IDS,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import { goldenSuite } from "@capsule/fixtures/vitest";
import { afterAll, beforeAll, vi } from "vitest";
import { RateLimitedError } from "./backoff.ts";
import { createPoller } from "./poller.ts";
import type { UsageProvider } from "./types.ts";

/**
 * The poller driven through a script of steps against providers with scripted
 * answers, recording what it published, fetched and persisted after each.
 */

type Outcome =
  | { snapshot: UsageSnapshot; thenEnable?: ProviderId[] }
  | {
      rateLimited: {
        retryAfterMs: number | null;
        fallback: UsageSnapshot | null;
      };
    }
  | { failed: true };

type Step =
  | { op: "start" | "refresh" | "tick" | "resume" | "online" | "sync" }
  | { op: "refreshProvider"; id: ProviderId }
  | { op: "advance"; ms: number }
  | { op: "setEnabled"; ids: ProviderId[] }
  | { op: "setBusy"; busy: boolean };

interface Scenario {
  now: string;
  settings: { enabled: ProviderId[]; pollIntervalMs: number };
  busy: boolean;
  idleIntervalMs?: number;
  remembered?: UsageSnapshot[];
  backoff?: Record<string, number>;
  outcomes: Partial<Record<ProviderId, Outcome[]>>;
  steps: Step[];
}

/** Lets the in-flight refresh, and any follow-up it queues, run to the end. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeAll(() => {
  // Placeholders are stamped with `new Date()`, so the clock is the script's.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

goldenSuite("usage/poller", async (scenario: Scenario) => {
  let clock = Date.parse(scenario.now);
  vi.setSystemTime(clock);
  let enabled = scenario.settings.enabled;
  let busy = scenario.busy;
  const calls: Partial<Record<ProviderId, number>> = {};
  const unscripted: string[] = [];
  let emitted: UsageSnapshot[][] = [];
  let fetched: ProviderId[] = [];
  let savedBackoff: Record<string, number> | null = null;
  let savedSnapshots: UsageSnapshot[] | null = null;
  const ticks: {
    interval?: () => void;
    resume?: () => void;
    online?: () => void;
  } = {};

  const providers: UsageProvider[] = PROVIDER_IDS.map((id) => ({
    id,
    fetchSnapshot: async () => {
      fetched.push(id);
      const index = calls[id] ?? 0;
      calls[id] = index + 1;
      const outcome = scenario.outcomes[id]?.[index];
      if (!outcome) {
        unscripted.push(`call ${index + 1} to ${id}`);
        throw new Error("unscripted");
      }
      if ("rateLimited" in outcome) {
        throw new RateLimitedError(
          outcome.rateLimited.retryAfterMs,
          outcome.rateLimited.fallback,
        );
      }
      if ("failed" in outcome) throw new Error(`${id} failed`);
      if (outcome.thenEnable) enabled = outcome.thenEnable;
      return outcome.snapshot;
    },
  }));

  const poller = createPoller({
    providers,
    host: {
      now: () => new Date(clock),
      fetch: globalThis.fetch,
      readFile: async () => null,
      homeDir: () => "/home",
      interval: (_ms, tick) => {
        ticks.interval = tick;
        return () => undefined;
      },
      onResume: (tick) => {
        ticks.resume = tick;
        return () => undefined;
      },
      onOnline: (tick) => {
        ticks.online = tick;
        return () => undefined;
      },
      loadBackoff: () => ({ ...(scenario.backoff ?? {}) }),
      saveBackoff: (until) => {
        savedBackoff = { ...until };
      },
      loadSnapshots: () => structuredClone(scenario.remembered ?? []),
      saveSnapshots: (snapshots) => {
        savedSnapshots = structuredClone(snapshots);
      },
    },
    getSettings: () => ({
      ...defaultSettings(),
      enabledProviderIds: enabled,
      pollIntervalMs: scenario.settings.pollIntervalMs,
    }),
    onChange: (snapshots) => emitted.push(structuredClone(snapshots)),
    isBusy: () => busy,
    idleIntervalMs: scenario.idleIntervalMs,
  });

  const after = [];
  for (const step of scenario.steps) {
    emitted = [];
    fetched = [];
    switch (step.op) {
      case "start":
        poller.start();
        break;
      case "refresh":
        await poller.refresh();
        break;
      case "refreshProvider":
        await poller.refreshProvider(step.id);
        break;
      case "tick":
        ticks.interval?.();
        break;
      case "resume":
        ticks.resume?.();
        break;
      case "online":
        ticks.online?.();
        break;
      case "sync":
        poller.sync();
        break;
      case "advance":
        clock += step.ms;
        vi.setSystemTime(clock);
        break;
      case "setEnabled":
        enabled = step.ids;
        break;
      case "setBusy":
        busy = step.busy;
        break;
    }
    await settle();
    after.push({
      op: step.op,
      fetched,
      emitted,
      snapshots: structuredClone(poller.getSnapshots()),
      backoff: savedBackoff,
      saved: savedSnapshots,
    });
  }
  poller.stop();
  // The poller swallows provider errors, so a call the scenario did not script
  // would otherwise pass for a provider failure and be recorded as one.
  if (unscripted.length > 0) {
    throw new Error(`scenario did not script: ${unscripted.join(", ")}`);
  }
  return after;
});
