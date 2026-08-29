import {
  type CapsuleSettings,
  type ProviderId,
  placeholderSnapshots,
  type UsageSnapshot,
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
  /** Re-reads every enabled provider over the network. */
  refresh: () => Promise<void>;
  /**
   * Reconciles the published list against the enabled providers without
   * touching the network, so toggling one lands immediately.
   */
  sync: () => void;
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
        } catch (error) {
          console.warn(
            `Capsule ${provider.id} failed`,
            error instanceof Error ? error.message : error,
          );
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

  const sync = () => {
    const settings = options.getSettings();
    // Placeholders define both the order and the enabled set; anything we
    // already know about a provider is carried over so nothing flickers.
    const next = placeholderSnapshots(settings.enabledProviderIds).map(
      (placeholder) =>
        snapshots.find((item) => item.providerId === placeholder.providerId) ??
        placeholder,
    );
    const unchanged =
      next.length === snapshots.length &&
      next.every((item, index) => item === snapshots[index]);
    if (unchanged) {
      return;
    }
    snapshots = next;
    options.onChange(snapshots);
  };

  return {
    start: () => {
      stop();
      const settings = options.getSettings();
      snapshots = placeholderSnapshots(settings.enabledProviderIds);
      options.onChange(snapshots);
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
    sync,
    getSnapshots: () => snapshots,
  };

  function stop() {
    for (const fn of stopFns) {
      fn();
    }
    stopFns = [];
  }
}
