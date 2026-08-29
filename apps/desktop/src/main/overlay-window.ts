import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  cardHeightForBuckets,
  computePlacement,
  HUD,
  hudMetrics,
  MOTION,
  nearestEdgeForPoint,
  PLACEMENT,
  type PlacementPreset,
  type PlacementResult,
  type ProviderId,
  presetForEdge,
  railLengthForCount,
  slideAlongEdge,
} from "@capsule/config";
import { BrowserWindow, screen, shell } from "electron";
import { readChromeSnapshot } from "./chrome.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

interface DragState {
  preset: PlacementPreset;
  placement: PlacementResult;
  /** Cursor offset from the leading edge of the window, along the slide axis. */
  grabOffset: number;
}

export class OverlayController {
  window: BrowserWindow | null = null;
  private settings: CapsuleSettings;
  private meterCount: number = HUD.meterCountDefault;
  private settingsDisplayId: number | null = null;
  private drag: DragState | null = null;
  private dragTimer: ReturnType<typeof setInterval> | null = null;
  private ignoreMouse = true;
  private onPresetPreview: ((preset: PlacementPreset) => void) | null = null;

  constructor(settings: CapsuleSettings) {
    this.settings = settings;
  }

  setSettings(settings: CapsuleSettings): void {
    this.settings = settings;
  }

  setMeterCount(count: number): void {
    this.meterCount = Math.max(1, count);
  }

  /** Lets the app broadcast a live orientation change while the dock is dragged. */
  onPresetChange(listener: (preset: PlacementPreset) => void): void {
    this.onPresetPreview = listener;
  }

  async create(onReady?: () => void): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

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

    // "screen-saver" keeps the notch above the menu bar; "floating" sits under it.
    win.setAlwaysOnTop(true, "screen-saver");
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
    if (this.drag) {
      this.setIgnore(false);
      return;
    }
    this.setIgnore(!capture);
  }

  setExpanded(_open: boolean, _providerId: ProviderId | null): void {
    // Window stays card-sized so the bubble can animate without clipping.
  }

  startMove(screenX: number, screenY: number): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    const bounds = win.getBounds();
    const placement = this.placementFor(this.settings.placementPreset);
    if (!placement) {
      return;
    }
    this.drag = {
      preset: this.settings.placementPreset,
      placement,
      grabOffset:
        placement.slide.axis === "x" ? screenX - bounds.x : screenY - bounds.y,
    };
    this.setIgnore(false);
    this.stopDragPoll();
    // Follow the cursor from the main process. A click-through overlay stops
    // receiving pointer events the moment it is no longer under the cursor,
    // so the renderer cannot be the source of truth for a drag.
    this.dragTimer = setInterval(() => {
      this.trackCursor();
    }, MOTION.dragPollMs);
    this.trackCursor();
  }

  endMove(): {
    placementPreset: PlacementPreset;
    customPosition: { x: number; y: number } | null;
  } | null {
    this.stopDragPoll();
    const drag = this.drag;
    this.drag = null;
    if (!drag) {
      return null;
    }
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return null;
    }
    const bounds = win.getBounds();
    this.settingsDisplayId = drag.placement.displayId;
    this.setIgnore(true);
    return {
      placementPreset: drag.preset,
      customPosition: { x: bounds.x, y: bounds.y },
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
    if (!win || win.isDestroyed() || this.drag) {
      return null;
    }
    const placement = await this.placementForAsync(
      this.settings.placementPreset,
    );
    if (!placement) {
      return null;
    }
    this.settingsDisplayId = placement.displayId;
    const custom = this.settings.customPosition;
    let { x, y } = placement;
    if (custom) {
      // A remembered position only says how far along the edge the dock sits;
      // the axis pinned to the edge always comes from the placement.
      const along = placement.slide.axis === "x" ? custom.x : custom.y;
      const clamped = Math.min(
        placement.slide.max,
        Math.max(placement.slide.min, along),
      );
      if (placement.slide.axis === "x") {
        x = clamped;
      } else {
        y = clamped;
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

  /** Window geometry for a preset on the display the dock currently lives on. */
  private placementFor(preset: PlacementPreset): PlacementResult | null {
    const displays = screen.getAllDisplays();
    const display =
      displays.find((item) => item.id === this.settingsDisplayId) ??
      screen.getPrimaryDisplay();
    return this.computeFor(preset, {
      display: {
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
      },
      // Dock metrics only matter for the bottom preset, and the work-area
      // inset already tells us the Dock's thickness during a drag.
      dock: { orientation: "bottom", autohide: false, tilesize: 48 },
    });
  }

  private async placementForAsync(
    preset: PlacementPreset,
  ): Promise<PlacementResult | null> {
    const displays = screen.getAllDisplays();
    const display =
      displays.find((item) => item.id === this.settingsDisplayId) ??
      screen.getPrimaryDisplay();
    const chrome = await readChromeSnapshot({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
    });
    return this.computeFor(preset, chrome);
  }

  private computeFor(
    preset: PlacementPreset,
    chrome: Parameters<typeof computePlacement>[1],
  ): PlacementResult {
    const metrics = hudMetrics(this.settings.hudScale);
    const notch = preset === "top-edge";
    return computePlacement(
      preset,
      chrome,
      {
        railWidth: metrics.railWidth,
        railLength: railLengthForCount(metrics, this.meterCount, notch),
        cardWidth: metrics.cardWidth,
        cardHeight: cardHeightForBuckets(metrics, 2),
        expanded: true,
        shadowPadding: metrics.shadowPadding,
        joinWidth: metrics.tailLength + metrics.joinGap,
        edgeFlare: metrics.edgeFlare,
      },
      PLACEMENT,
    );
  }

  /**
   * Re-docks to whichever screen edge the cursor is nearest, then slides the
   * dock along that edge. Crossing into another edge's wedge flips the whole
   * layout mid-drag.
   */
  private trackCursor(): void {
    const win = this.window;
    const drag = this.drag;
    if (!win || win.isDestroyed() || !drag) {
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const edge = nearestEdgeForPoint(cursor, display.bounds);
    const preset = presetForEdge(edge);

    let placement = drag.placement;
    if (preset !== drag.preset || display.id !== placement.displayId) {
      this.settingsDisplayId = display.id;
      const next = this.placementFor(preset);
      if (next) {
        placement = next;
        // Re-grab from the middle so the dock does not lurch when it rotates.
        const span =
          placement.slide.axis === "x" ? placement.width : placement.height;
        drag.grabOffset = span / 2;
        drag.preset = preset;
        drag.placement = placement;
        this.onPresetPreview?.(preset);
      }
    }

    const next = slideAlongEdge({
      slide: placement.slide,
      anchorX: placement.x,
      anchorY: placement.y,
      cursor,
      grabOffset: drag.grabOffset,
    });
    win.setBounds(
      {
        x: next.x,
        y: next.y,
        width: Math.round(placement.width),
        height: Math.round(placement.height),
      },
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
