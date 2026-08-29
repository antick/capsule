import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  computePlacement,
  HUD,
  MOTION,
  PLACEMENT,
  type PlacementPreset,
  type PlacementResult,
  type ProviderId,
  snapAfterDrag,
} from "@capsule/config";
import { BrowserWindow, screen, shell } from "electron";
import { readChromeSnapshot } from "./chrome.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

const METER_BLOCK = HUD.meterSize + HUD.itemGap + HUD.percentBlock;

export class OverlayController {
  window: BrowserWindow | null = null;
  private settings: CapsuleSettings;
  private meterCount: number = HUD.meterCountDefault;
  private settingsDisplayId: number | null = null;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

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
      focusable: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(false);
    win.setMenuBarVisibility(false);

    win.webContents.setWindowOpenHandler((details) => {
      void shell.openExternal(details.url);
      return { action: "deny" };
    });

    this.window = win;
    await this.relayout();

    win.webContents.on("did-finish-load", () => {
      win.show();
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

    win.show();
    return win;
  }

  setPointerCapture(capture: boolean): void {
    if (this.dragging) {
      return;
    }
    this.window?.setIgnoreMouseEvents(!capture, { forward: true });
  }

  setExpanded(_open: boolean, _providerId: ProviderId | null): void {
    // Window stays expanded-sized so the card can animate in CSS.
  }

  startMove(screenX: number, screenY: number): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    const bounds = win.getBounds();
    this.dragging = true;
    this.dragOffsetX = screenX - bounds.x;
    this.dragOffsetY = screenY - bounds.y;
    win.setIgnoreMouseEvents(false);
  }

  moveWindow(screenX: number, screenY: number): void {
    const win = this.window;
    if (!win || win.isDestroyed() || !this.dragging) {
      return;
    }
    win.setPosition(
      Math.round(screenX - this.dragOffsetX),
      Math.round(screenY - this.dragOffsetY),
    );
  }

  endMove(): {
    placementPreset: PlacementPreset;
    customPosition: { x: number; y: number } | null;
  } | null {
    const win = this.window;
    this.dragging = false;
    if (!win || win.isDestroyed()) {
      return null;
    }
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const snapped = snapAfterDrag(
      bounds,
      display.bounds,
      MOTION.snapDistancePx,
    );
    win.setBounds({
      x: snapped.x,
      y: snapped.y,
      width: bounds.width,
      height: bounds.height,
    });
    this.settingsDisplayId = display.id;
    return {
      placementPreset: snapped.preset,
      customPosition: snapped.snapped ? null : { x: snapped.x, y: snapped.y },
    };
  }

  hide(): void {
    this.window?.hide();
  }

  show(): void {
    this.window?.show();
  }

  async relayout(): Promise<PlacementResult | null> {
    const win = this.window;
    if (!win || win.isDestroyed() || this.dragging) {
      return null;
    }
    const primary = screen.getPrimaryDisplay();
    const displays = screen.getAllDisplays();
    const display =
      displays.find((item) => item.id === this.settingsDisplayId) ?? primary;
    this.settingsDisplayId = display.id;
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
        cardHeight: HUD.cardHeight,
        expanded: true,
        shadowPadding: HUD.shadowPadding,
      },
      PLACEMENT,
    );
    let x = placement.x;
    let y = placement.y;
    const custom = this.settings.customPosition;
    if (custom) {
      x = custom.x;
      y = custom.y;
    }
    const bounds = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(placement.width),
      height: Math.round(placement.height),
    };
    win.setBounds(bounds);
    return { ...placement, x: bounds.x, y: bounds.y };
  }
}
