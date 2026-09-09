import { join } from "node:path";
import { APP_NAME, IPC } from "@capsule/config";
import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { hideFromMacDock } from "./macos-dock.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

let settingsWindow: BrowserWindow | null = null;

/** The overlay is not focusable, so the app itself may not be frontmost. */
function bringForward(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }
  if (process.platform === "darwin") {
    // Capsule lives in the menu bar with no Dock tile, so nothing else will
    // bring it forward for us.
    app.focus({ steal: true });
  }
  // A minimised window ignores show(), and with no Dock tile there is nothing
  // to click to get it back — so it would look like settings never opened.
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
  hideFromMacDock();
}

/**
 * Opens settings, or raises the window that is already open.
 *
 * Nothing here waits on the renderer. An earlier version asked the open window
 * to change its own hash with `executeJavaScript` and awaited the result: if
 * that renderer was gone or wedged the promise never settled, so every later
 * attempt to open settings silently did nothing at all. The window is shown
 * first and told where to navigate afterwards, one-way.
 */
export function openSettingsWindow(hash = "/"): BrowserWindow {
  const existing = settingsWindow;
  if (existing && !existing.isDestroyed()) {
    existing.webContents.send(IPC.navigate, hash);
    bringForward(existing);
    return existing;
  }

  const win = new BrowserWindow({
    title: `${APP_NAME} Settings`,
    width: 940,
    height: 740,
    minWidth: 820,
    minHeight: 600,
    show: false,
    skipTaskbar: true,
    // The sidebar is left unpainted so macOS's own material shows through it;
    // the window therefore cannot carry an opaque colour of its own, and the
    // content column paints the background instead.
    backgroundColor: "#00000000",
    vibrancy: "sidebar",
    visualEffectState: "active",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 20 },
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

  // The page follows `prefers-color-scheme`, which Chromium only re-evaluates
  // when the window is told the system appearance moved.
  const onThemeChange = () => {
    if (!win.isDestroyed()) {
      win.setVibrancy("sidebar");
    }
  };
  nativeTheme.on("updated", onThemeChange);

  // Registered before the load: ready-to-show fires during it, and a listener
  // attached afterwards misses the event and leaves the window hidden.
  win.once("ready-to-show", () => bringForward(win));
  win.on("closed", () => {
    nativeTheme.off("updated", onThemeChange);
    if (settingsWindow === win) {
      settingsWindow = null;
    }
  });
  settingsWindow = win;
  hideFromMacDock();

  const devUrl = rendererDevUrl("settings");
  const load = devUrl
    ? win.loadURL(`${devUrl}#${hash}`)
    : win.loadFile(rendererHtml("settings"), { hash });

  load.then(
    () => bringForward(win),
    (error: unknown) => {
      // A half-loaded window would be handed back to every later caller, so
      // it is thrown away and the next attempt starts clean.
      console.error("Capsule settings failed to load", error);
      if (settingsWindow === win) {
        settingsWindow = null;
      }
      if (!win.isDestroyed()) {
        win.destroy();
      }
    },
  );

  return win;
}
