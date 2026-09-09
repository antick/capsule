import {
  type CapsuleSettings,
  initialUpdateState,
  plainReleaseNotes,
  releaseUrlFor,
  UPDATE_COPY,
  UPDATE_TIMING,
  type UpdateState,
} from "@capsule/config";
import { app, shell } from "electron";
import electronUpdater, { type UpdateInfo } from "electron-updater";
import {
  downloadFraction,
  isUnsupportedUpdateError,
  updateErrorMessage,
} from "./update-support.ts";

// electron-updater ships CommonJS; the named export is not reachable from ESM.
const { autoUpdater } = electronUpdater;

export interface UpdaterHandlers {
  getSettings: () => CapsuleSettings;
  /** Push the new state at every window that might be showing it. */
  onChange: (state: UpdateState) => void;
}

export interface Updater {
  state: () => UpdateState;
  /** Ask the feed now. `manual` surfaces failures the user asked to see. */
  check: (manual: boolean) => Promise<void>;
  download: () => Promise<void>;
  /** Quit and let the staged version take over. */
  install: () => void;
  openReleasePage: () => void;
  /** Begin the launch check and the daily one, if the setting allows. */
  start: () => void;
  /** Re-read the automatic-check setting after it has been changed. */
  syncSchedule: () => void;
  stop: () => void;
}

export function createUpdater(handlers: UpdaterHandlers): Updater {
  // A packaged build knows its own feed from `app-update.yml`; a dev run has
  // no feed and no signature, so it is told so rather than left retrying.
  let state = initialUpdateState(app.getVersion(), app.isPackaged);
  let launchTimer: NodeJS.Timeout | null = null;
  let intervalTimer: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> | null = null;

  const publish = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    handlers.onChange(state);
  };

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = null;

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    publish({
      phase: "available",
      availableVersion: info.version,
      releaseNotes: plainReleaseNotes(info.releaseNotes),
      checkedAt: new Date().toISOString(),
      error: null,
    });
    if (handlers.getSettings().autoUpdateDownload) {
      void download();
    }
  });

  autoUpdater.on("update-not-available", () => {
    publish({
      phase: "current",
      availableVersion: null,
      releaseNotes: null,
      progress: null,
      checkedAt: new Date().toISOString(),
      error: null,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    publish({
      phase: "downloading",
      progress: {
        fraction: downloadFraction(progress.percent),
        transferredBytes: progress.transferred,
        totalBytes: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      },
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    publish({
      phase: "ready",
      availableVersion: info.version,
      releaseNotes: plainReleaseNotes(info.releaseNotes) ?? state.releaseNotes,
      progress: null,
      error: null,
    });
  });

  autoUpdater.on("error", (error: Error) => {
    fail(error);
  });

  function fail(error: unknown): void {
    const message = updateErrorMessage(error);
    // A build that cannot replace itself is not a transient failure, and
    // saying "could not check" would send the user back to press it again.
    if (isUnsupportedUpdateError(message)) {
      publish({
        phase: "unsupported",
        canInstall: false,
        progress: null,
        error: message,
        checkedAt: new Date().toISOString(),
      });
      return;
    }
    publish({
      phase: "error",
      progress: null,
      error: message,
      checkedAt: new Date().toISOString(),
    });
  }

  async function check(manual: boolean): Promise<void> {
    if (!state.canInstall && !manual) {
      return;
    }
    if (inFlight) {
      return inFlight;
    }
    if (!app.isPackaged) {
      // Nothing to check against: an unpackaged run has no `app-update.yml`
      // and would only produce a confusing ENOENT.
      publish({
        phase: "unsupported",
        canInstall: false,
        checkedAt: new Date().toISOString(),
      });
      return;
    }
    publish({ phase: "checking", error: null });
    // electron-updater retries a failing feed for a while before it gives up.
    // Without a deadline the panel would sit on "Checking…" with no way back
    // to the button that started it.
    inFlight = Promise.race([
      autoUpdater.checkForUpdates().then(() => undefined),
      timeout(UPDATE_TIMING.timeoutMs),
    ])
      .catch((error: unknown) => {
        fail(error);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  function timeout(ms: number): Promise<never> {
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(UPDATE_COPY.timedOut)),
        ms,
      );
      // A short-lived timer would otherwise keep the app awake past a quit.
      timer.unref?.();
    });
  }

  async function download(): Promise<void> {
    if (state.phase === "downloading" || state.phase === "ready") {
      return;
    }
    publish({ phase: "downloading", progress: null, error: null });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      fail(error);
    }
  }

  return {
    state: () => state,
    check,
    download,
    install: () => {
      if (state.phase !== "ready") {
        return;
      }
      // The overlay is always-on-top and has no close button of its own, so
      // let the app tear itself down the way a quit would before restarting.
      app.removeAllListeners("window-all-closed");
      autoUpdater.quitAndInstall();
    },
    openReleasePage: () => {
      void shell.openExternal(
        releaseUrlFor(state.availableVersion ?? state.currentVersion),
      );
    },
    start: schedule,
    syncSchedule: schedule,
    stop,
  };

  /**
   * Idempotent: switching the setting on and off again must not leave two
   * intervals behind asking the feed twice a day.
   */
  function schedule(): void {
    stop();
    if (!handlers.getSettings().autoUpdateCheck || !state.canInstall) {
      return;
    }
    launchTimer = setTimeout(() => {
      void check(false);
    }, UPDATE_TIMING.launchDelayMs);
    intervalTimer = setInterval(() => {
      void check(false);
    }, UPDATE_TIMING.intervalMs);
  }

  function stop(): void {
    if (launchTimer) {
      clearTimeout(launchTimer);
      launchTimer = null;
    }
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
  }
}
