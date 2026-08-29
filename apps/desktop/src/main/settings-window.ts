import { join } from "node:path";
import { APP_NAME } from "@capsule/config";
import { BrowserWindow, shell } from "electron";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

let settingsWindow: BrowserWindow | null = null;

export async function openSettingsWindow(hash = "/"): Promise<BrowserWindow> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    await settingsWindow.webContents.executeJavaScript(
      `window.location.hash = ${JSON.stringify(`#${hash}`)}`,
    );
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const win = new BrowserWindow({
    title: `${APP_NAME} Settings`,
    width: 520,
    height: 640,
    minWidth: 420,
    minHeight: 480,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
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

  const devUrl = rendererDevUrl("settings");
  if (devUrl) {
    await win.loadURL(`${devUrl}#${hash}`);
  } else {
    await win.loadFile(rendererHtml("settings"), { hash });
  }

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    settingsWindow = null;
  });
  settingsWindow = win;
  return win;
}
