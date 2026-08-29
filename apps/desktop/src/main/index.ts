import {
  APP_NAME,
  type CapsuleSettings,
  CHROME_POLL_MS,
  COPY,
  IPC,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  powerMonitor,
  screen,
} from "electron";
import { OverlayController } from "./overlay-window.ts";
import { openSettingsWindow } from "./settings-window.ts";
import { loadSettings, saveSettings } from "./store.ts";
import { createUsageHost } from "./usage-host.ts";

app.setName(APP_NAME);

if (process.platform === "darwin") {
  app.dock?.show();
}

let settings = loadSettings();
const overlay = new OverlayController(settings);
let snapshots: UsageSnapshot[] = [];

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
  return settings;
}

app.whenReady().then(async () => {
  const login = app.getLoginItemSettings();
  if (login.openAtLogin !== settings.launchAtLogin) {
    settings = saveSettings({ ...settings, launchAtLogin: login.openAtLogin });
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: APP_NAME,
        submenu: [
          { label: COPY.settings, click: () => void openSettingsWindow("/") },
          { type: "separator" },
          { role: "quit", label: COPY.quit },
        ],
      },
    ]),
  );

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
    Menu.buildFromTemplate([
      { label: COPY.settings, click: () => void openSettingsWindow("/") },
      { type: "separator" },
      { label: COPY.quit, click: () => app.quit() },
    ]).popup();
  });

  await overlay.create(() => {
    broadcast();
    overlay.show();
  });
  poller.start();
  await poller.refresh();
  broadcast();
  overlay.show();
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
