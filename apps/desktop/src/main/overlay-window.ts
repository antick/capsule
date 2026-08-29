import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  cardHeightForBuckets,
  computePlacement,
  HUD,
  layoutForPreset,
  MOTION,
  PLACEMENT,
  type PlacementPreset,
  type PlacementResult,
  type ProviderId,
  railLengthForCount,
  slideAlongEdge,
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
  private dragLockX = 0;
  private dragLockY = 0;
  private dragOrientation: "vertical" | "horizontal" = "vertical";
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
    // The dock stays welded to its edge; a drag only slides it along that edge.
    this.dragLockX = bounds.x;
    this.dragLockY = bounds.y;
    this.dragOrientation = layoutForPreset(
      this.settings.placementPreset,
    ).orientation;
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
    const work = display.workArea;
    // Only the free axis needs clamping; the locked one is already flush.
    const vertical = this.dragOrientation === "vertical";
    const x = vertical
      ? this.dragLockX
      : clamp(bounds.x, work.x, work.x + work.width - bounds.width);
    const y = vertical
      ? clamp(bounds.y, work.y, work.y + work.height - bounds.height)
      : this.dragLockY;
    win.setBounds({ x, y, width: bounds.width, height: bounds.height }, false);
    this.settingsDisplayId = display.id;
    this.setIgnore(true);
    return {
      placementPreset: this.settings.placementPreset,
      customPosition: { x, y },
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
        cardHeight: cardHeightForBuckets(2),
        expanded: true,
        shadowPadding: HUD.shadowPadding,
        joinWidth: HUD.tailLength + HUD.joinGap,
        edgeFlare: HUD.edgeFlare,
      },
      PLACEMENT,
    );
    let x = placement.x;
    let y = placement.y;
    const custom = this.settings.customPosition;
    const work = chrome.display.workArea;
    if (custom) {
      // A remembered position only overrides how far along the edge the dock
      // sits; the axis pinned to the edge always comes from the placement.
      if (placement.orientation === "vertical") {
        y = clamp(custom.y, work.y, work.y + work.height - placement.height);
      } else {
        x = clamp(custom.x, work.x, work.x + work.width - placement.width);
      }
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
    const display = screen.getDisplayNearestPoint({
      x: this.dragLockX,
      y: screenY,
    });
    const next = slideAlongEdge({
      orientation: this.dragOrientation,
      lockedX: this.dragLockX,
      lockedY: this.dragLockY,
      width: bounds.width,
      height: bounds.height,
      screenX,
      screenY,
      offsetX: this.dragOffsetX,
      offsetY: this.dragOffsetY,
      workArea: display.workArea,
    });
    win.setBounds(
      { ...bounds, x: Math.round(next.x), y: Math.round(next.y) },
      false,
    );
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
