import { writeFile } from "node:fs/promises";
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
  railLengthForCount,
  snapAfterDrag,
} from "@capsule/config";
import { BrowserWindow, screen, shell } from "electron";
import { readChromeSnapshot } from "./chrome.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

export class OverlayController {
  window: BrowserWindow | null = null;
  private settings: CapsuleSettings;
  private meterCount: number = HUD.meterCountDefault;
  private settingsDisplayId: number | null = null;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragTimer: ReturnType<typeof setInterval> | null = null;
  private ignoreMouse = true;

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
    if (this.dragging) {
      this.setIgnore(false);
      return;
    }
    this.setIgnore(!capture);
  }

  setExpanded(_open: boolean, _providerId: ProviderId | null): void {
    // Window stays card-sized so the blob can animate without clipping.
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
    this.setIgnore(false);
    this.stopDragPoll();
    this.dragTimer = setInterval(() => {
      if (!this.dragging || !this.window || this.window.isDestroyed()) {
        return;
      }
      const point = screen.getCursorScreenPoint();
      this.applyDragPosition(point.x, point.y);
    }, MOTION.dragPollMs);
  }

  moveWindow(screenX: number, screenY: number): void {
    if (!this.dragging) {
      return;
    }
    this.applyDragPosition(screenX, screenY);
  }

  endMove(): {
    placementPreset: PlacementPreset;
    customPosition: { x: number; y: number } | null;
  } | null {
    this.stopDragPoll();
    if (!this.dragging) {
      return null;
    }
    this.dragging = false;
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return null;
    }
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const snapped = snapAfterDrag(
      bounds,
      display.workArea,
      MOTION.snapDistancePx,
    );
    win.setBounds(
      {
        x: snapped.x,
        y: snapped.y,
        width: bounds.width,
        height: bounds.height,
      },
      false,
    );
    this.settingsDisplayId = display.id;
    this.setIgnore(true);
    return {
      placementPreset: snapped.preset,
      customPosition: { x: snapped.x, y: snapped.y },
    };
  }

  hide(): void {
    this.window?.hide();
  }

  show(): void {
    this.window?.showInactive();
  }

  async debugState(): Promise<{ capsule: string; text: string } | null> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return null;
    }
    return win.webContents.executeJavaScript(`({
      capsule: typeof window.capsule,
      text: (document.body.innerText || "").replace(/\\s+/g, " ").trim(),
    })`);
  }

  async openProvider(providerId: ProviderId): Promise<void> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    await win.webContents.executeJavaScript(
      `(() => {
        const el = document.querySelector('[data-provider="${providerId}"]');
        if (!el) return false;
        el.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
        el.click();
        return true;
      })()`,
    );
  }

  async capturePng(dest: string): Promise<string | null> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return null;
    }
    const image = await win.webContents.capturePage();
    await writeFile(dest, image.toPNG());
    return dest;
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
    const placement = computePlacement(
      this.settings.placementPreset,
      chrome,
      {
        railWidth: HUD.railWidth,
        railLength: railLengthForCount(this.meterCount),
        cardWidth: HUD.cardWidth,
        cardHeight: HUD.cardHeight,
        expanded: true,
        shadowPadding: HUD.shadowPadding,
        joinWidth: HUD.joinWidth,
      },
      PLACEMENT,
    );
    let x = placement.x;
    let y = placement.y;
    const custom = this.settings.customPosition;
    const work = chrome.display.workArea;
    if (custom) {
      const snapped = snapAfterDrag(
        {
          x: custom.x,
          y: custom.y,
          width: placement.width,
          height: placement.height,
        },
        work,
        MOTION.snapDistancePx,
      );
      x = snapped.x;
      y = snapped.y;
    }
    const bounds = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(placement.width),
      height: Math.round(placement.height),
    };
    win.setBounds(bounds, false);
    return { ...placement, x: bounds.x, y: bounds.y };
  }

  private applyDragPosition(screenX: number, screenY: number): void {
    const win = this.window;
    if (!win || win.isDestroyed() || !this.dragging) {
      return;
    }
    const bounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
    const work = display.workArea;
    const x = clamp(
      Math.round(screenX - this.dragOffsetX),
      work.x,
      work.x + work.width - bounds.width,
    );
    const y = clamp(
      Math.round(screenY - this.dragOffsetY),
      work.y,
      work.y + work.height - bounds.height,
    );
    win.setBounds({ ...bounds, x, y }, false);
  }

  private stopDragPoll(): void {
    if (this.dragTimer) {
      clearInterval(this.dragTimer);
      this.dragTimer = null;
    }
  }

  private setIgnore(ignore: boolean): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    if (this.ignoreMouse === ignore) {
      return;
    }
    this.ignoreMouse = ignore;
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
