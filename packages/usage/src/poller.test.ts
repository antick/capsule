import {
  type CapsuleSettings,
  defaultSettings,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import { describe, expect, it, vi } from "vitest";
import { createPoller, type PollerHost } from "./poller.ts";
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
