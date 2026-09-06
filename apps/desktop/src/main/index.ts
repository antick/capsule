import { createActivityMonitor } from "@capsule/activity/monitor";
import { createNoticeTracker } from "@capsule/activity/notices";
import { createTokenScanner } from "@capsule/activity/tokens";
import {
  type ActivityByProvider,
  APP_NAME,
  type CapsuleSettings,
  CHROME_POLL_MS,
  IPC,
  NOTICE_IPC,
  type PlacementPreset,
  type ProviderId,
  type Rect,
  type TokenUsageByProvider,
  type UsageSnapshot,
} from "@capsule/config";
import { app, BrowserWindow, ipcMain, powerMonitor, screen } from "electron";
import { createActivityHost } from "./activity-host.ts";
import { createAppChrome } from "./app-chrome.ts";
import { hideFromMacDock } from "./macos-dock.ts";
import { OverlayController } from "./overlay-window.ts";
import { openSettingsWindow } from "./settings-window.ts";
import {
  loadSettings,
  loadTokenCache,
  saveSettings,
  saveTokenCache,
} from "./store.ts";
import { createUsageHost } from "./usage-host.ts";

app.setName(APP_NAME);

app.on("will-finish-launching", () => {
  hideFromMacDock();
});

let settings = loadSettings();
const overlay = new OverlayController(settings);
let snapshots: UsageSnapshot[] = [];
let activity: ActivityByProvider = {};
let tokens: TokenUsageByProvider = {};
const notices = createNoticeTracker();
let appChrome: ReturnType<typeof createAppChrome> | null = null;
/**
 * Whether an auto-hiding dock is being held out. A gesture, not a setting:
 * it lasts as long as this run of the app, and main owns it so the dock and
 * the menus agree.
 */
let keepOpen = false;

const broadcast = () => {
  overlay.setMeterCount(snapshots.length || 1);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.snapshots, snapshots, settings);
  }
};

const broadcastActivity = () => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.activity, activity);
  }
};

// The token scanner's cache lives in the readings store; the host itself is
// kept free of the store so it can be exercised without Electron around.
const activityHost = {
  ...createActivityHost(),
  loadTokenCache,
  saveTokenCache,
};

const monitor = createActivityMonitor({
  host: activityHost,
  getEnabled: () => settings.enabledProviderIds,
  onChange: (next) => {
    activity = next;
    broadcastActivity();
    const pending = notices.update(next, new Date());
    overlay.window?.webContents.send(NOTICE_IPC.changed, pending);
  },
});

const tokenScanner = createTokenScanner({
  host: activityHost,
  getEnabled: () => settings.enabledProviderIds,
  onChange: (next) => {
    tokens = next;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.tokens, tokens);
    }
  },
});

const usageHost = () =>
  createUsageHost(
    () => settings,
    (next) => {
      snapshots = next;
      broadcast();
      void overlay.relayout();
    },
    { isBusy: () => monitor.isBusy() },
  );

let poller = usageHost();

function rebuildPoller(): void {
  poller.stop();
  poller = usageHost();
  poller.start();
}

function setKeepOpen(next: boolean): void {
  if (keepOpen === next) {
    return;
  }
  keepOpen = next;
  overlay.window?.webContents.send(IPC.keepOpen, keepOpen);
  appChrome?.sync(settings);
}

function applySettings(next: CapsuleSettings): CapsuleSettings {
  const demoChanged = next.demoMode !== settings.demoMode;
  const pollChanged = next.pollIntervalMs !== settings.pollIntervalMs;
  settings = saveSettings(next);
  overlay.setSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  // Always shown, the dock is already held out by a setting; a hand-made
  // hold would only outlive a later switch back.
  if (!settings.autoHide) {
    setKeepOpen(false);
  }
  if (demoChanged || pollChanged) {
    rebuildPoller();
  } else {
    // Reconcile the provider list first so a toggle lands in the dock now
    // rather than after the next round of network calls returns.
    poller.sync();
    void poller.refresh();
  }
  void monitor.rescan();
  void tokenScanner.rescan();
  void overlay.relayout();
  broadcast();
  appChrome?.sync(settings);
  return settings;
}

app.whenReady().then(async () => {
  // Become a menu-bar extra before any window exists. A regular BrowserWindow
  // can put the Dock tile back if we still look like a normal app.
  hideFromMacDock();

  const login = app.getLoginItemSettings();
  if (login.openAtLogin !== settings.launchAtLogin) {
    settings = saveSettings({ ...settings, launchAtLogin: login.openAtLogin });
  }

  appChrome = createAppChrome({
    getSettings: () => settings,
    applyPlacement: (preset: PlacementPreset) => {
      applySettings({
        ...settings,
        placementPreset: preset,
        customPosition: null,
        customCorner: null,
      });
    },
    openSettings: () => {
      openSettingsWindow("/");
    },
    revealDock: () => overlay.reveal(),
    getKeepOpen: () => keepOpen,
    toggleKeepOpen: () => setKeepOpen(!keepOpen),
    quit: () => app.quit(),
  });

  // Dragging past a screen edge re-docks the HUD, and the renderer has to
  // re-orient with it. Keep this in memory only; endMove writes the result.
  overlay.onPresetChange((preset) => {
    if (settings.placementPreset === preset) {
      return;
    }
    settings = { ...settings, placementPreset: preset };
    overlay.setSettings(settings);
    broadcast();
    appChrome?.sync(settings);
  });

  ipcMain.handle(IPC.getSettings, () => settings);
  ipcMain.handle(IPC.getSnapshots, () => ({ snapshots, settings }));
  ipcMain.handle(IPC.getDockFrame, () => overlay.dockFrame());
  ipcMain.handle(IPC.setSettings, (_event, next: CapsuleSettings) =>
    applySettings(next),
  );
  // Returns nothing on purpose: a BrowserWindow cannot cross the IPC bridge.
  ipcMain.handle(IPC.openSettings, (_event, hash?: string) => {
    openSettingsWindow(hash ?? "/");
  });
  ipcMain.handle(IPC.quit, () => {
    app.quit();
  });
  ipcMain.on(IPC.setPointerCapture, (_event, capture: boolean) => {
    overlay.setPressed(capture);
  });
  ipcMain.on(IPC.setHitRegions, (_event, regions: Rect[]) => {
    overlay.setHitRegions(regions);
  });
  ipcMain.on(
    IPC.setExpanded,
    (_event, open: boolean, providerId: ProviderId | null) => {
      overlay.setExpanded(open, providerId);
    },
  );
  ipcMain.on(IPC.startMove, (_event, screenX: number, screenY: number) => {
    overlay.startMove(screenX, screenY);
  });
  ipcMain.handle(IPC.endMove, () => {
    const next = overlay.endMove();
    if (next) {
      applySettings({ ...settings, ...next });
    }
  });
  ipcMain.on(IPC.refreshProvider, (_event, providerId: ProviderId) => {
    void poller.refreshProvider(providerId);
  });
  ipcMain.on(IPC.revealDock, () => {
    overlay.reveal();
  });
  ipcMain.handle(IPC.getActivity, () => activity);
  ipcMain.handle(IPC.getTokens, () => tokens);
  ipcMain.handle(NOTICE_IPC.get, (event) =>
    event.sender === overlay.window?.webContents ? notices.get() : [],
  );
  ipcMain.on(NOTICE_IPC.read, (event, ids: unknown) => {
    if (
      event.sender !== overlay.window?.webContents ||
      !Array.isArray(ids) ||
      !ids.every((id) => typeof id === "string")
    )
      return;
    overlay.window.webContents.send(NOTICE_IPC.changed, notices.markRead(ids));
  });
  ipcMain.on(NOTICE_IPC.dismiss, (event, id: unknown) => {
    if (event.sender !== overlay.window?.webContents || typeof id !== "string")
      return;
    overlay.window.webContents.send(NOTICE_IPC.changed, notices.dismiss(id));
  });
  ipcMain.handle(IPC.getKeepOpen, () => keepOpen);
  ipcMain.on(IPC.setKeepOpen, (_event, next: boolean) => {
    setKeepOpen(next === true);
  });
  ipcMain.on(IPC.contextMenu, () => {
    // The dock outranks pop-up menus, so it has to step down for one.
    overlay.suspendAlwaysOnTop();
    appChrome?.popup(() => overlay.restoreAlwaysOnTop());
  });

  app.on("activate", () => {
    openSettingsWindow("/");
  });

  await overlay.create(() => {
    broadcast();
    overlay.show();
  });
  hideFromMacDock();
  monitor.start();
  tokenScanner.start();
  poller.start();
  await poller.refresh();
  broadcast();
  overlay.show();
  console.info(
    "Capsule usage",
    snapshots
      .map(
        (item) =>
          `${item.providerId}:${item.status}:${item.primaryPercent ?? "—"}`,
      )
      .join(" "),
  );
  if (snapshots.some((item) => item.status === "unauthenticated")) {
    openSettingsWindow("/onboarding");
  }

  const chromeTimer = setInterval(() => {
    void overlay.relayout();
  }, CHROME_POLL_MS);

  screen.on("display-metrics-changed", () => {
    overlay.invalidateHardwareNotch();
    void overlay.relayout();
  });
  screen.on("display-added", () => {
    overlay.invalidateHardwareNotch();
    void overlay.relayout();
  });
  screen.on("display-removed", () => {
    overlay.invalidateHardwareNotch();
    void overlay.relayout();
  });
  powerMonitor.on("resume", () => {
    void overlay.relayout();
  });

  app.on("before-quit", () => {
    clearInterval(chromeTimer);
    poller.stop();
    monitor.stop();
    tokenScanner.stop();
    overlay.destroy();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
