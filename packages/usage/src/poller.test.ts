import {
  type CapsuleSettings,
  defaultSettings,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "./backoff.ts";
import { createPoller, type PollerHost, shouldRefresh } from "./poller.ts";
import type { UsageProvider } from "./types.ts";

const host: PollerHost = {
  now: () => new Date("2026-01-01T00:00:00.000Z"),
  fetch: () => Promise.reject(new Error("no network in tests")),
  readFile: () => Promise.resolve(null),
  homeDir: () => "/tmp",
  interval: () => () => undefined,
  onResume: () => () => undefined,
  onOnline: () => () => undefined,
};

/** Never resolves, standing in for a provider waiting on the network. */
function stalledProvider(id: ProviderId): UsageProvider {
  return {
    id,
    fetchSnapshot: () => new Promise<UsageSnapshot>(() => undefined),
  };
}

function setup(enabled: ProviderId[]) {
  let settings: CapsuleSettings = {
    ...defaultSettings(),
    enabledProviderIds: enabled,
  };
  const onChange = vi.fn();
  const poller = createPoller({
    providers: [
      stalledProvider("claude"),
      stalledProvider("codex"),
      stalledProvider("grok"),
    ],
    host,
    getSettings: () => settings,
    onChange,
  });
  return {
    poller,
    onChange,
    setEnabled: (next: ProviderId[]) => {
      settings = { ...settings, enabledProviderIds: next };
    },
  };
}

describe("poller.sync", () => {
  it("publishes a disabled provider's removal without waiting on the network", () => {
    const { poller, onChange, setEnabled } = setup(["claude", "codex", "grok"]);
    poller.start();
    onChange.mockClear();

    setEnabled(["claude", "grok"]);
    poller.sync();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(poller.getSnapshots().map((item) => item.providerId)).toEqual([
      "claude",
      "grok",
    ]);
  });

  it("adds a re-enabled provider back in the configured order", () => {
    const { poller, onChange, setEnabled } = setup(["claude"]);
    poller.start();
    onChange.mockClear();

    setEnabled(["claude", "codex", "grok"]);
    poller.sync();

    expect(poller.getSnapshots().map((item) => item.providerId)).toEqual([
      "claude",
      "codex",
      "grok",
    ]);
  });

  it("stays quiet when the enabled set has not moved", () => {
    const { poller, onChange } = setup(["claude", "codex"]);
    poller.start();
    onChange.mockClear();

    poller.sync();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("poller.refresh", () => {
  it("flags every enabled provider while its fetch is in the air", async () => {
    const { poller } = setup(["claude", "codex"]);
    poller.start();

    // Providers never resolve here, so this is the mid-flight state.
    void poller.refresh();
    await Promise.resolve();

    expect(
      poller.getSnapshots().map((item) => [item.providerId, item.refreshing]),
    ).toEqual([
      ["claude", true],
      ["codex", true],
    ]);
  });

  // sync() rather than start(): start kicks off a full refresh, and these
  // providers never resolve, so every ring would already be sweeping.
  it("sweeps only the ring the user asked for", async () => {
    const { poller } = setup(["claude", "codex"]);
    poller.sync();

    void poller.refreshProvider("codex");
    await Promise.resolve();

    expect(
      poller.getSnapshots().map((item) => [item.providerId, item.refreshing]),
    ).toEqual([
      ["claude", false],
      ["codex", true],
    ]);
  });

  it("ignores a second ask while that provider is already in the air", async () => {
    const { poller, onChange } = setup(["claude"]);
    poller.sync();
    void poller.refreshProvider("claude");
    await Promise.resolve();
    onChange.mockClear();

    void poller.refreshProvider("claude");
    await Promise.resolve();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores an ask for a provider that is switched off", async () => {
    const { poller, onChange } = setup(["claude"]);
    poller.sync();
    onChange.mockClear();

    await poller.refreshProvider("grok");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the numbers already on screen while the sweep runs", async () => {
    const { poller } = setup(["claude"]);
    poller.start();
    const before = poller.getSnapshots()[0];

    void poller.refresh();
    await Promise.resolve();

    const during = poller.getSnapshots()[0];
    expect(during?.refreshing).toBe(true);
    expect(during?.primaryPercent).toBe(before?.primaryPercent);
    expect(during?.status).toBe(before?.status);
  });
});

describe("poller scheduling", () => {
  it("polls at full rate while an agent works and idles otherwise", () => {
    expect(shouldRefresh(true, 0, 300_000)).toBe(true);
    expect(shouldRefresh(false, 60_000, 300_000)).toBe(false);
    expect(shouldRefresh(false, 300_000, 300_000)).toBe(true);
  });

  it("skips the interval tick while every agent is idle", () => {
    let tick: (() => void) | null = null;
    const fetchSnapshot = vi.fn(() =>
      Promise.resolve<UsageSnapshot>({
        providerId: "claude",
        displayName: "Claude",
        iconId: "claude",
        primaryPercent: 10,
        buckets: [],
        status: "ok",
        fetchedAt: host.now().toISOString(),
      }),
    );
    const poller = createPoller({
      providers: [{ id: "claude", fetchSnapshot }],
      host: {
        ...host,
        interval: (_ms, fn) => {
          tick = fn;
          return () => undefined;
        },
      },
      getSettings: () => ({
        ...defaultSettings(),
        enabledProviderIds: ["claude"],
      }),
      onChange: () => undefined,
      isBusy: () => false,
      idleIntervalMs: 300_000,
    });
    poller.start();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    (tick as unknown as () => void)();
    // The clock has not moved, so the idle interval has not passed.
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("poller back-off", () => {
  it("holds the last numbers, dated, and stops asking until the penalty ends", async () => {
    let clock = new Date("2026-01-01T00:00:00.000Z");
    const saved: Record<string, number>[] = [];
    const good: UsageSnapshot = {
      providerId: "claude",
      displayName: "Claude",
      iconId: "claude",
      primaryPercent: 40,
      buckets: [],
      status: "ok",
      fetchedAt: clock.toISOString(),
    };
    let answer: () => Promise<UsageSnapshot> = () => Promise.resolve(good);
    const calls = vi.fn(() => answer());
    const poller = createPoller({
      providers: [{ id: "claude", fetchSnapshot: calls }],
      host: {
        ...host,
        now: () => clock,
        saveBackoff: (until) => {
          saved.push(until);
        },
      },
      getSettings: () => ({
        ...defaultSettings(),
        enabledProviderIds: ["claude"],
      }),
      onChange: () => undefined,
    });
    await poller.refresh();
    expect(poller.getSnapshots()[0]?.status).toBe("ok");

    clock = new Date(clock.getTime() + 60_000);
    answer = () => Promise.reject(new RateLimitedError(0));
    await poller.refresh();
    const stale = poller.getSnapshots()[0];
    expect(stale?.status).toBe("stale");
    expect(stale?.primaryPercent).toBe(40);
    expect(stale?.staleSince).toBe(good.fetchedAt);
    expect(saved.at(-1)?.claude).toBe(clock.getTime() + 60_000);

    // Inside the penalty nothing is fetched at all.
    const before = calls.mock.calls.length;
    clock = new Date(clock.getTime() + 30_000);
    await poller.refresh();
    expect(calls.mock.calls.length).toBe(before);
    expect(poller.getSnapshots()[0]?.status).toBe("stale");

    // Once it has passed, the next attempt goes through and clears it.
    clock = new Date(clock.getTime() + 60_000);
    answer = () => Promise.resolve({ ...good, fetchedAt: clock.toISOString() });
    await poller.refresh();
    expect(poller.getSnapshots()[0]?.status).toBe("ok");
    expect(saved.at(-1)).toEqual({});
  });
});
