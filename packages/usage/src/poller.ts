import type {
  CapsuleSettings,
  ProviderId,
  UsageSnapshot,
} from "@capsule/config";
import { mergeSnapshot } from "./merge.ts";
import type { UsageProvider, UsageProviderContext } from "./types.ts";

export interface PollerHost {
  now: () => Date;
  fetch: typeof fetch;
  readFile: (absolutePath: string) => Promise<string | null>;
  readSecret?: (service: string) => Promise<string | null>;
  homeDir: () => string;
  interval: (ms: number, tick: () => void) => () => void;
  onResume: (tick: () => void) => () => void;
  onOnline: (tick: () => void) => () => void;
}

export interface Poller {
  start: () => void;
  stop: () => void;
  refresh: () => Promise<void>;
  getSnapshots: () => UsageSnapshot[];
}

export function createPoller(options: {
  providers: UsageProvider[];
  host: PollerHost;
  getSettings: () => CapsuleSettings;
  onChange: (snapshots: UsageSnapshot[]) => void;
}): Poller {
  let snapshots: UsageSnapshot[] = [];
  let stopFns: Array<() => void> = [];
  let inFlight: Promise<void> | null = null;

  const context = (): UsageProviderContext => ({
    now: options.host.now(),
    fetch: options.host.fetch,
    readFile: options.host.readFile,
    readSecret: options.host.readSecret,
    homeDir: options.host.homeDir(),
  });

  const refresh = async () => {
    if (inFlight) {
      return inFlight;
    }
    inFlight = (async () => {
      const settings = options.getSettings();
      const enabled = new Set<ProviderId>(settings.enabledProviderIds);
      const next: UsageSnapshot[] = [];
      for (const provider of options.providers) {
        if (!enabled.has(provider.id)) {
          continue;
        }
        const previous = snapshots.find(
          (item) => item.providerId === provider.id,
        );
        try {
          const fetched = await provider.fetchSnapshot(context());
          next.push(mergeSnapshot(previous, fetched));
        } catch {
          next.push(
            mergeSnapshot(previous, {
              providerId: provider.id,
              displayName: provider.id,
              iconId: provider.id,
              primaryPercent: previous?.primaryPercent ?? null,
              buckets: previous?.buckets ?? [],
              status: "error",
              fetchedAt: options.host.now().toISOString(),
            }),
          );
        }
      }
      snapshots = next;
      options.onChange(snapshots);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    start: () => {
      stop();
      const settings = options.getSettings();
      stopFns = [
        options.host.interval(settings.pollIntervalMs, () => {
          void refresh();
        }),
        options.host.onResume(() => {
          void refresh();
        }),
        options.host.onOnline(() => {
          void refresh();
        }),
      ];
      void refresh();
    },
    stop,
    refresh,
    getSnapshots: () => snapshots,
  };

  function stop() {
    for (const fn of stopFns) {
      fn();
    }
    stopFns = [];
  }
}
