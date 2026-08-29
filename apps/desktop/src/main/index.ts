import {
  APP_NAME,
  type CapsuleSettings,
  CHROME_POLL_MS,
  IPC,
  type PlacementPreset,
  type ProviderId,
  type Rect,
  type UsageSnapshot,
} from "@capsule/config";
import { app, BrowserWindow, ipcMain, powerMonitor, screen } from "electron";
import { createAppChrome } from "./app-chrome.ts";
import { hideFromMacDock } from "./macos-dock.ts";
import { OverlayController } from "./overlay-window.ts";
import { openSettingsWindow } from "./settings-window.ts";
import { loadSettings, saveSettings } from "./store.ts";
import { createUsageHost } from "./usage-host.ts";

app.setName(APP_NAME);

let settings = loadSettings();
const overlay = new OverlayController(settings);
let snapshots: UsageSnapshot[] = [];
let appChrome: ReturnType<typeof createAppChrome> | null = null;

const broadcast = () => {
  overlay.setMeterCount(snapshots.length || 1);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.snapshots, snapshots, settings);
  }
};

let poller = createUsageHost(
  () => settings,
  (next) => {
    snapshots = next;
    broadcast();
    void overlay.relayout();
  },
);

function rebuildPoller(): void {
  poller.stop();
  poller = createUsageHost(
    () => settings,
    (next) => {
      snapshots = next;
      broadcast();
      void overlay.relayout();
    },
  );
  poller.start();
}

function applySettings(next: CapsuleSettings): CapsuleSettings {
  const demoChanged = next.demoMode !== settings.demoMode;
  const pollChanged = next.pollIntervalMs !== settings.pollIntervalMs;
  settings = saveSettings(next);
  overlay.setSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  if (demoChanged || pollChanged) {
    rebuildPoller();
  } else {
    // Reconcile the provider list first so a toggle lands in the dock now
    // rather than after the next round of network calls returns.
    poller.sync();
    void poller.refresh();
  }
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
      });
    },
    openSettings: () => {
      openSettingsWindow("/");
    },
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
  if (!settings.demoMode && snapshots.every((item) => item.status !== "ok")) {
    openSettingsWindow("/onboarding");
  }

  const chromeTimer = setInterval(() => {
    void overlay.relayout();
  }, CHROME_POLL_MS);

  screen.on("display-metrics-changed", () => {
    void overlay.relayout();
  });
  screen.on("display-removed", () => {
    void overlay.relayout();
  });
  powerMonitor.on("resume", () => {
    void overlay.relayout();
  });

  app.on("before-quit", () => {
    clearInterval(chromeTimer);
    poller.stop();
    overlay.destroy();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
