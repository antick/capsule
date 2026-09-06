import {
  ACTIVITY,
  type ActivityByProvider,
  anyAgentActive,
  type ProviderId,
} from "@capsule/config";
import { claudeSessionsDir, readClaudeSessions } from "./claude.ts";
import { readCodexSessions } from "./codex.ts";
import { readGrokSessions } from "./grok.ts";
import type { ActivityHost } from "./host.ts";

export interface ActivityMonitor {
  start: () => void;
  stop: () => void;
  /** Re-read every source now. */
  rescan: () => Promise<void>;
  getActivity: () => ActivityByProvider;
  /** Whether any agent, for any enabled provider, is doing something. */
  isBusy: () => boolean;
}

/**
 * Watches every agent tool it knows how to read and publishes what they are
 * doing. Claude Code's registry is watched as well as polled, because it
 * writes a session file the moment its state changes, so "Claude just
 * finished" shows up immediately; the poll is there to notice processes that
 * died without touching the directory, which no file event will ever report.
 */
export function createActivityMonitor(options: {
  host: ActivityHost;
  getEnabled: () => readonly ProviderId[];
  onChange: (activity: ActivityByProvider) => void;
}): ActivityMonitor {
  let activity: ActivityByProvider = {};
  let stopFns: Array<() => void> = [];
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  const readers: Record<
    ProviderId,
    (host: ActivityHost) => Promise<ActivityByProvider[ProviderId]>
  > = {
    claude: readClaudeSessions,
    codex: readCodexSessions,
    grok: readGrokSessions,
  };

  const rescan = (): Promise<void> => {
    if (inFlight) {
      return inFlight;
    }
    inFlight = (async () => {
      const enabled = new Set(options.getEnabled());
      const next: ActivityByProvider = {};
      for (const id of Object.keys(readers) as Array<keyof typeof readers>) {
        if (!enabled.has(id)) {
          continue;
        }
        try {
          const sessions = await readers[id](options.host);
          if (sessions && sessions.length > 0) {
            next[id] = sessions;
          }
        } catch (error) {
          console.warn(
            `Capsule ${id} activity failed`,
            error instanceof Error ? error.message : error,
          );
        }
      }
      // Only churn the renderer for a change it can see.
      if (JSON.stringify(next) !== JSON.stringify(activity)) {
        activity = next;
        options.onChange(activity);
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const scheduleRescan = () => {
    if (debounce) {
      clearTimeout(debounce);
    }
    debounce = setTimeout(() => {
      debounce = null;
      void rescan();
    }, ACTIVITY.watchDebounceMs);
  };

  return {
    start: () => {
      stop();
      stopFns = [
        options.host.interval(ACTIVITY.pollMs, () => {
          void rescan();
        }),
      ];
      const watch = options.host.watchDir?.(
        claudeSessionsDir(options.host),
        scheduleRescan,
      );
      if (watch) {
        stopFns.push(watch);
      }
      void rescan();
    },
    stop,
    rescan,
    getActivity: () => activity,
    isBusy: () => anyAgentActive(activity),
  };

  function stop() {
    for (const fn of stopFns) {
      fn();
    }
    stopFns = [];
    if (debounce) {
      clearTimeout(debounce);
      debounce = null;
    }
  }
}
