import {
  type CapsuleSettings,
  IDLE_POLL_INTERVAL_MS,
  PROVIDER_LABELS,
  type ProviderId,
  placeholderSnapshots,
  type UsageSnapshot,
} from "@capsule/config";
import { backoffMs, RateLimitedError } from "./backoff.ts";
import { mergeSnapshot } from "./merge.ts";
import type { UsageProvider, UsageProviderContext } from "./types.ts";

export interface PollerHost {
  now: () => Date;
  fetch: typeof fetch;
  readFile: (absolutePath: string) => Promise<string | null>;
  readSecret?: (service: string) => Promise<string | null>;
  runCommand?: (
    file: string,
    args: readonly string[],
  ) => Promise<string | null>;
  homeDir: () => string;
  interval: (ms: number, tick: () => void) => () => void;
  onResume: (tick: () => void) => () => void;
  onOnline: (tick: () => void) => () => void;
  /**
   * Where a rate-limit penalty is remembered across launches, so relaunching
   * during one waits it out instead of spending an attempt on it. Keyed by
   * provider, valued by the epoch millisecond the penalty ends.
   */
  loadBackoff?: () => Record<string, number>;
  saveBackoff?: (until: Record<string, number>) => void;
  /**
   * The last readings, remembered across launches so the dock has numbers the
   * moment it appears rather than a row of dashes until the first fetch lands.
   */
  loadSnapshots?: () => UsageSnapshot[];
  saveSnapshots?: (snapshots: UsageSnapshot[]) => void;
}

/**
 * What to show at launch: the remembered reading for each enabled provider,
 * dated and marked stale so it never passes for live, or a placeholder where
 * nothing useful was remembered.
 */
export function rememberedSnapshots(
  enabled: readonly ProviderId[],
  remembered: readonly UsageSnapshot[],
): UsageSnapshot[] {
  return placeholderSnapshots(enabled).map((placeholder) => {
    const old = remembered.find(
      (item) => item.providerId === placeholder.providerId,
    );
    if (
      !old ||
      (old.status !== "ok" && old.status !== "stale") ||
      old.buckets.length === 0
    ) {
      return placeholder;
    }
    return {
      ...old,
      status: "stale",
      staleSince: old.staleSince ?? old.fetchedAt,
      refreshing: false,
    };
  });
}

/**
 * Poll at full rate while an agent is working; otherwise wait out the idle
 * interval. Pure, so the schedule can be tested without a clock.
 */
export function shouldRefresh(
  busy: boolean,
  sinceLastAttemptMs: number,
  idleIntervalMs: number = IDLE_POLL_INTERVAL_MS,
): boolean {
  return busy || sinceLastAttemptMs >= idleIntervalMs;
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
  /**
   * Whether any agent is working right now. Left out, the poller assumes it
   * always is and polls at full rate.
   */
  isBusy?: () => boolean;
  idleIntervalMs?: number;
}): Poller {
  let snapshots: UsageSnapshot[] = [];
  let stopFns: Array<() => void> = [];
  let inFlight: Promise<void> | null = null;
  let lastAttempt: number | null = null;
  /** Epoch millisecond each rate-limited provider may be asked again. */
  const blockedUntil = new Map<string, number>(
    Object.entries(options.host.loadBackoff?.() ?? {}),
  );
  /** How many 429s in a row each provider has answered with. */
  const refusals = new Map<string, number>();

  const persistBackoff = () => {
    options.host.saveBackoff?.(Object.fromEntries(blockedUntil));
  };

  const context = (): UsageProviderContext => ({
    now: options.host.now(),
    fetch: options.host.fetch,
    readFile: options.host.readFile,
    readSecret: options.host.readSecret,
    runCommand: options.host.runCommand,
    homeDir: options.host.homeDir(),
  });

  /** Writes the readings down, minus the in-flight flag that means nothing later. */
  const remember = () => {
    options.host.saveSnapshots?.(
      snapshots.map(({ refreshing: _refreshing, ...item }) => item),
    );
  };

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

  /** The last numbers we had, dated, in place of a fetch that did not happen. */
  const heldBack = (
    provider: UsageProvider,
    previous: UsageSnapshot | undefined,
  ): UsageSnapshot =>
    mergeSnapshot(previous, {
      providerId: provider.id,
      displayName: PROVIDER_LABELS[provider.id],
      iconId: provider.id,
      primaryPercent: previous?.primaryPercent ?? null,
      buckets: previous?.buckets ?? [],
      status: "error",
      fetchedAt: options.host.now().toISOString(),
    });

  /** One provider's turn on the network, with a failure folded into a snapshot. */
  const fetchOne = async (provider: UsageProvider): Promise<UsageSnapshot> => {
    const previous = snapshots.find((item) => item.providerId === provider.id);
    const now = options.host.now().getTime();
    // Inside a penalty the answer is already known: show the dated numbers
    // rather than spend an attempt extending the penalty.
    if ((blockedUntil.get(provider.id) ?? 0) > now) {
      return heldBack(provider, previous);
    }
    try {
      const fresh = mergeSnapshot(
        previous,
        await provider.fetchSnapshot(context()),
      );
      if (blockedUntil.delete(provider.id)) {
        persistBackoff();
      }
      refusals.delete(provider.id);
      return fresh;
    } catch (error) {
      if (error instanceof RateLimitedError) {
        const attempt = (refusals.get(provider.id) ?? 0) + 1;
        refusals.set(provider.id, attempt);
        const wait = backoffMs(attempt, error.retryAfterMs);
        blockedUntil.set(provider.id, now + wait);
        persistBackoff();
        console.warn(
          `Capsule ${provider.id} rate limited (${attempt}x), next attempt in ${Math.round(wait / 1000)}s`,
        );
        if (error.fallback) {
          return mergeSnapshot(previous, error.fallback);
        }
      } else {
        console.warn(
          `Capsule ${provider.id} failed`,
          error instanceof Error ? error.message : error,
        );
      }
      return heldBack(provider, previous);
    }
  };

  const refresh = async () => {
    if (inFlight) {
      return inFlight;
    }
    lastAttempt = options.host.now().getTime();
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
      remember();
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
    remember();
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
      snapshots = rememberedSnapshots(
        settings.enabledProviderIds,
        options.host.loadSnapshots?.() ?? [],
      );
      options.onChange(snapshots);
      stopFns = [
        options.host.interval(settings.pollIntervalMs, () => {
          // Refreshing when nobody is working only spends rate limit on
          // numbers that cannot have moved.
          const waited =
            lastAttempt === null
              ? Number.POSITIVE_INFINITY
              : options.host.now().getTime() - lastAttempt;
          if (
            !shouldRefresh(
              options.isBusy?.() ?? true,
              waited,
              options.idleIntervalMs,
            )
          ) {
            return;
          }
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
