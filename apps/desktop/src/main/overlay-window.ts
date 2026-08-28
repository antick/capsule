import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  computePlacement,
  HUD,
  PLACEMENT,
  type PlacementResult,
  type ProviderId,
} from "@capsule/config";
import { BrowserWindow, screen, shell } from "electron";
import { readChromeSnapshot } from "./chrome.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

const METER_BLOCK = HUD.meterSize + HUD.itemGap + 18;

export class OverlayController {
  window: BrowserWindow | null = null;
  private expanded = false;
  private settings: CapsuleSettings;
  private meterCount: number = HUD.meterCountDefault;

  constructor(settings: CapsuleSettings) {
    this.settings = settings;
  }

  setSettings(settings: CapsuleSettings): void {
    this.settings = settings;
  }

  setMeterCount(count: number): void {
    this.meterCount = Math.max(1, count);
  }

  async create(onReady?: () => void): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    const win = new BrowserWindow({
      title: APP_NAME,
      width: HUD.railWidth,
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
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      webPreferences: {
        // electron-vite rewrites this static join(__dirname) path in dev.
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setMenuBarVisibility(false);

    win.webContents.setWindowOpenHandler((details) => {
      void shell.openExternal(details.url);
      return { action: "deny" };
    });

    this.window = win;
    await this.relayout();

    win.webContents.on("did-finish-load", () => {
      win.showInactive();
      onReady?.();
    });
    win.webContents.on("did-fail-load", (_event, code, description, url) => {
      console.error("Capsule overlay failed to load", {
        code,
        description,
        url,
      });
    });

    const devUrl = rendererDevUrl("overlay");
    if (devUrl) {
      await win.loadURL(devUrl);
    } else {
      await win.loadFile(rendererHtml("overlay"));
    }

    win.showInactive();
    return win;
  }

  setPointerCapture(capture: boolean): void {
    this.window?.setIgnoreMouseEvents(!capture, { forward: true });
  }

  setExpanded(open: boolean, _providerId: ProviderId | null): void {
    this.expanded = open;
    void this.relayout();
  }

  hide(): void {
    this.window?.hide();
  }

  show(): void {
    this.window?.showInactive();
  }

  async relayout(): Promise<PlacementResult | null> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return null;
    }
    const display =
      screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) ??
      screen.getPrimaryDisplay();
    const chrome = await readChromeSnapshot({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
    });
    const railLength =
      HUD.railPaddingY * 2 + this.meterCount * METER_BLOCK - HUD.itemGap;
    const placement = computePlacement(
      this.settings.placementPreset,
      chrome,
      {
        railWidth: HUD.railWidth,
        railLength,
        cardWidth: HUD.cardWidth,
        cardHeight: 188,
        expanded: this.expanded,
        shadowPadding: HUD.shadowPadding,
      },
      PLACEMENT,
    );
    win.setBounds({
      x: Math.round(placement.x),
      y: Math.round(placement.y),
      width: Math.round(placement.width),
      height: Math.round(placement.height),
    });
    return placement;
  }
}
