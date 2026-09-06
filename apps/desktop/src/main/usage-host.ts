import {
  type CapsuleSettings,
  DEMO_SNAPSHOTS,
  placeholderSnapshots,
  type UsageSnapshot,
} from "@capsule/config";
import type { Poller } from "@capsule/usage";

/** Local display only: no provider clients, credentials, network, or timers. */
export function createUsageHost(
  getSettings: () => CapsuleSettings,
  onChange: (snapshots: UsageSnapshot[]) => void,
): Poller {
  let snapshots: UsageSnapshot[] = [];
  const publish = () => {
    const settings = getSettings();
    const enabled = new Set(settings.enabledProviderIds);
    snapshots = settings.demoMode
      ? DEMO_SNAPSHOTS.filter((item) => enabled.has(item.providerId))
      : placeholderSnapshots(settings.enabledProviderIds)
          .filter((item) => enabled.has(item.providerId))
          .map((item) => ({ ...item, status: "disabled" as const }));
    onChange(snapshots);
  };
  return {
    start: publish,
    stop: () => {},
    sync: publish,
    refresh: async () => publish(),
    refreshProvider: async () => publish(),
    getSnapshots: () => snapshots,
  };
}
