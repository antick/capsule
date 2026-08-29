import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  CHROME_POLL_MS,
  IPC,
  MOTION,
  type PlacementPreset,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import { app, BrowserWindow, ipcMain, powerMonitor, screen } from "electron";
import { createAppChrome } from "./app-chrome.ts";
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
    void poller.refresh();
  }
  void overlay.relayout();
  broadcast();
  appChrome?.sync(settings);
  return settings;
}

app.whenReady().then(async () => {
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
      void openSettingsWindow("/placement");
    },
    quit: () => app.quit(),
  });

  ipcMain.handle(IPC.getSettings, () => settings);
  ipcMain.handle(IPC.getSnapshots, () => ({ snapshots, settings }));
  ipcMain.handle(IPC.setSettings, (_event, next: CapsuleSettings) =>
    applySettings(next),
  );
  ipcMain.handle(IPC.openSettings, (_event, hash?: string) =>
    openSettingsWindow(hash ?? "/"),
  );
  ipcMain.handle(IPC.quit, () => {
    app.quit();
  });
  ipcMain.on(IPC.setPointerCapture, (_event, capture: boolean) => {
    overlay.setPointerCapture(capture);
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
  ipcMain.on(IPC.moveWindow, (_event, screenX: number, screenY: number) => {
    overlay.moveWindow(screenX, screenY);
  });
  ipcMain.handle(IPC.endMove, () => {
    const next = overlay.endMove();
    if (next) {
      applySettings({ ...settings, ...next });
    }
  });
  ipcMain.on(IPC.contextMenu, () => {
    appChrome?.popup();
  });

  app.on("activate", () => {
    void openSettingsWindow("/placement");
  });

  await overlay.create(() => {
    broadcast();
    overlay.show();
  });
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
  if (!app.isPackaged) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
    broadcast();
    const overlayInfo = await overlay.debugState();
    console.info("Capsule overlay", overlayInfo);
    await overlay.openProvider("grok");
    await new Promise((resolve) => {
      setTimeout(resolve, MOTION.cardMs + MOTION.blobMs);
    });
    const dest = join(tmpdir(), "capsule-app.png");
    const captured = await overlay.capturePng(dest);
    console.info("Capsule capture", captured);
  }
  if (!settings.demoMode && snapshots.every((item) => item.status !== "ok")) {
    await openSettingsWindow("/onboarding");
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
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
