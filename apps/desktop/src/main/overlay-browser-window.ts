import { join } from "node:path";
import { APP_NAME } from "@capsule/config";
import { BrowserWindow, shell } from "electron";

/** Above the menu bar, so the notch can cover it. */
export const TOP_LEVEL = "screen-saver";
/** Above the menu bar but below pop-up menus: floating hides the notch behind the menu bar. */
export const MENU_SAFE_LEVEL = "pop-up-menu";
export const MENU_SAFE_RELATIVE_LEVEL = -1;

/**
 * The transparent, click-through, always-on-top panel the dock is drawn in.
 * Its size and place come from the placement engine; this only decides what
 * kind of window it is.
 */
export function createOverlayBrowserWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 320,
    height: 280,
    x: 0,
    y: 0,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    roundedCorners: false,
    skipTaskbar: true,
    focusable: false,
    acceptFirstMouse: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hiddenInMissionControl: true,
    type: "panel",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, TOP_LEVEL);
  // Electron's default here calls dock.show() when visibleOnFullScreen is
  // false — that is what kept putting the Electron tile back in the Dock
  // after every accessory-policy hide. Skip the process-type transform so
  // the HUD can still ride every Space and stay off native fullscreen.
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: false,
    skipTransformProcessType: true,
  });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  return win;
}
