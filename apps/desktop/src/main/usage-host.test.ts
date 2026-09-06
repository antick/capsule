import { defaultSettings } from "@capsule/config";
import { afterEach, expect, it, vi } from "vitest";
import { createUsageHost } from "./usage-host.ts";

afterEach(() => vi.unstubAllGlobals());

it("keeps every refresh and settings path offline with no stale account numbers", async () => {
  const fetch = vi.fn(() => {
    throw new Error("Network access is forbidden");
  });
  const interval = vi.fn(() => {
    throw new Error("Polling is forbidden");
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("setInterval", interval);
  let settings = { ...defaultSettings(), demoMode: false };
  const host = createUsageHost(() => settings, vi.fn());
  host.start();
  await host.refresh();
  for (const id of settings.enabledProviderIds) await host.refreshProvider(id);
  expect(host.getSnapshots()).toHaveLength(3);
  expect(
    host
      .getSnapshots()
      .every(
        (item) =>
          item.status === "disabled" &&
          item.primaryPercent === null &&
          item.buckets.length === 0,
      ),
  ).toBe(true);
  settings = { ...settings, demoMode: true };
  host.sync();
  expect(host.getSnapshots()[0]?.primaryPercent).toBe(73);
  settings = { ...settings, demoMode: false };
  host.sync();
  expect(
    host
      .getSnapshots()
      .every(
        (item) => item.status === "disabled" && item.primaryPercent === null,
      ),
  ).toBe(true);
  settings = { ...settings, enabledProviderIds: [] };
  host.sync();
  expect(host.getSnapshots()).toEqual([]);
  host.stop();
  expect(fetch).not.toHaveBeenCalled();
  expect(interval).not.toHaveBeenCalled();
});
