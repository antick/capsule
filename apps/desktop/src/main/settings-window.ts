import { join } from "node:path";
import { APP_NAME } from "@capsule/config";
import { app, BrowserWindow, shell } from "electron";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

let settingsWindow: BrowserWindow | null = null;

/** The overlay is not focusable, so the app itself may not be frontmost. */
function bringForward(win: BrowserWindow): void {
  win.show();
  win.focus();
  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }
}

export async function openSettingsWindow(hash = "/"): Promise<BrowserWindow> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    await settingsWindow.webContents.executeJavaScript(
      `window.location.hash = ${JSON.stringify(`#${hash}`)}`,
    );
    bringForward(settingsWindow);
    return settingsWindow;
  }

  const win = new BrowserWindow({
    title: `${APP_NAME} Settings`,
    width: 820,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: "#0d0d0f",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      // electron-vite rewrites this static join(__dirname) path in dev.
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Registered before the load: ready-to-show fires during it, and a listener
  // attached afterwards misses the event and leaves the window hidden.
  win.once("ready-to-show", () => bringForward(win));
  win.on("closed", () => {
    settingsWindow = null;
  });
  settingsWindow = win;

  const devUrl = rendererDevUrl("settings");
  if (devUrl) {
    await win.loadURL(`${devUrl}#${hash}`);
  } else {
    await win.loadFile(rendererHtml("settings"), { hash });
  }

  if (!win.isDestroyed()) {
    bringForward(win);
  }
  return win;
}
