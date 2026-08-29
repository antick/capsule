import {
  type CapsuleSettings,
  PROVIDER_LABELS,
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
  /** Re-reads a single provider, for when the user asks for that one. */
  refreshProvider: (providerId: ProviderId) => Promise<void>;
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

  /** Flags the providers still being waited on, keeping their last numbers. */
  const markRefreshing = (ids: Set<ProviderId>) => {
    const next = snapshots.map((item) =>
      item.refreshing === ids.has(item.providerId)
        ? item
        : { ...item, refreshing: ids.has(item.providerId) },
    );
    if (next.every((item, index) => item === snapshots[index])) {
      return;
    }
    snapshots = next;
    options.onChange(snapshots);
  };

  /** One provider's turn on the network, with a failure folded into a snapshot. */
  const fetchOne = async (provider: UsageProvider): Promise<UsageSnapshot> => {
    const previous = snapshots.find((item) => item.providerId === provider.id);
    try {
      return mergeSnapshot(previous, await provider.fetchSnapshot(context()));
    } catch (error) {
      console.warn(
        `Capsule ${provider.id} failed`,
        error instanceof Error ? error.message : error,
      );
      return mergeSnapshot(previous, {
        providerId: provider.id,
        displayName: PROVIDER_LABELS[provider.id],
        iconId: provider.id,
        primaryPercent: previous?.primaryPercent ?? null,
        buckets: previous?.buckets ?? [],
        status: "error",
        fetchedAt: options.host.now().toISOString(),
      });
    }
  };

  const refresh = async () => {
    if (inFlight) {
      return inFlight;
    }
    inFlight = (async () => {
      const settings = options.getSettings();
      const enabled = new Set<ProviderId>(settings.enabledProviderIds);
      // Providers are fetched in turn, so clearing each one as it lands makes
      // the rail settle in order rather than all at once.
      const pending = new Set<ProviderId>(enabled);
      markRefreshing(pending);
      const next: UsageSnapshot[] = [];
      for (const provider of options.providers) {
        if (!enabled.has(provider.id)) {
          continue;
        }
        next.push(await fetchOne(provider));
        pending.delete(provider.id);
        markRefreshing(pending);
      }
      snapshots = next.map((item) => ({ ...item, refreshing: false }));
      options.onChange(snapshots);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const refreshProvider = async (providerId: ProviderId) => {
    const provider = options.providers.find((item) => item.id === providerId);
    const enabled = new Set<ProviderId>(
      options.getSettings().enabledProviderIds,
    );
    // A sweep already running on this ring is the answer to a second click.
    if (!provider || !enabled.has(providerId)) {
      return;
    }
    if (
      snapshots.some(
        (item) => item.providerId === providerId && item.refreshing,
      )
    ) {
      return;
    }
    markRefreshing(refreshingIds().add(providerId));
    const fetched = await fetchOne(provider);
    snapshots = snapshots.map((item) =>
      item.providerId === providerId ? { ...fetched, refreshing: false } : item,
    );
    options.onChange(snapshots);
  };

  const refreshingIds = (): Set<ProviderId> =>
    new Set(
      snapshots
        .filter((item) => item.refreshing)
        .map((item) => item.providerId),
    );

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
    refreshProvider,
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
