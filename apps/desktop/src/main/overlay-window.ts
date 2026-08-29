import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  cardHeightForBuckets,
  computePlacement,
  dockEdgeGap,
  dockStyleFor,
  HUD,
  hudMetrics,
  MOTION,
  nearestEdgeForPoint,
  PLACEMENT,
  type PlacementPreset,
  type PlacementResult,
  type ProviderId,
  presetForEdge,
  type Rect,
  railLengthForCount,
  slideAlongEdge,
  styleSupportsNotch,
} from "@capsule/config";
import { BrowserWindow, screen, shell } from "electron";
import { readChromeSnapshot } from "./chrome.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

/** Above the menu bar, so the notch can cover it. */
const TOP_LEVEL = "screen-saver";
/** Below pop-up menus, so a context menu is not hidden by the dock. */
const MENU_SAFE_LEVEL = "floating";

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
  private hoverTimer: ReturnType<typeof setInterval> | null = null;
  private ignoreMouse = true;
  private pressed = false;
  /** Window-local areas the dock wants the mouse for, reported by the renderer. */
  private hitRegions: Rect[] = [];
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

    win.setAlwaysOnTop(true, TOP_LEVEL);
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
    this.startHoverTracking();
    return win;
  }

  /**
   * The renderer cannot decide when the dock should swallow the mouse. macOS
   * only forwards move events to a click-through window while the owning app
   * is frontmost, so with another app in focus the overlay would never learn
   * the cursor had arrived and would stay transparent to it forever. Instead
   * the main process reads the cursor itself and hit-tests the regions the
   * renderer publishes.
   */
  setHitRegions(regions: Rect[]): void {
    this.hitRegions = regions;
    this.updateHover();
  }

  /** Held from pointerdown to pointerup: never go click-through mid-press. */
  setPressed(pressed: boolean): void {
    this.pressed = pressed;
    if (pressed) {
      this.setIgnore(false);
    } else {
      this.updateHover();
    }
  }

  setExpanded(_open: boolean, _providerId: ProviderId | null): void {
    // Window stays card-sized so the bubble can animate without clipping.
  }

  /** Drops below pop-up menu level so a context menu draws over the dock. */
  suspendAlwaysOnTop(): void {
    this.window?.setAlwaysOnTop(true, MENU_SAFE_LEVEL);
  }

  restoreAlwaysOnTop(): void {
    this.window?.setAlwaysOnTop(true, TOP_LEVEL);
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

  destroy(): void {
    this.stopDragPoll();
    if (this.hoverTimer) {
      clearInterval(this.hoverTimer);
      this.hoverTimer = null;
    }
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
    const style = dockStyleFor(this.settings.dockStyle);
    const notchAllowed = styleSupportsNotch(style);
    // Matches UsageDock: a dock lying along an edge drops its percent
    // captions, which makes its rail shorter than a vertical one.
    const compact = preset === "top-edge" || preset === "bottom-edge";
    return computePlacement(
      preset,
      chrome,
      {
        railWidth: metrics.railWidth,
        railLength: railLengthForCount(metrics, this.meterCount, compact),
        cardWidth: metrics.cardWidth,
        // Sized for the tallest card, since the window cannot resize itself
        // mid-animation without the bubble tearing.
        cardHeight: cardHeightForBuckets(metrics, HUD.maxCardBuckets),
        expanded: true,
        shadowPadding: metrics.shadowPadding,
        joinWidth: metrics.tailLength + metrics.joinGap,
        edgeFlare: metrics.edgeFlare * style.flare,
        edgeGap: dockEdgeGap(metrics, style),
      },
      PLACEMENT,
      { notchAllowed },
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

  private startHoverTracking(): void {
    if (this.hoverTimer) {
      return;
    }
    this.hoverTimer = setInterval(() => {
      this.updateHover();
    }, MOTION.hoverPollMs);
  }

  private updateHover(): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    // A press or a drag owns the mouse until it ends, whatever the cursor
    // is over — the dock may well have slid out from under it.
    if (this.pressed || this.drag) {
      this.setIgnore(false);
      return;
    }
    if (!win.isVisible() || this.hitRegions.length === 0) {
      this.setIgnore(true);
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const x = cursor.x - bounds.x;
    const y = cursor.y - bounds.y;
    this.setIgnore(!this.hitRegions.some((rect) => contains(rect, x, y)));
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

function contains(rect: Rect, x: number, y: number): boolean {
  const slop = MOTION.hoverSlopPx;
  return (
    x >= rect.x - slop &&
    x <= rect.x + rect.width + slop &&
    y >= rect.y - slop &&
    y <= rect.y + rect.height + slop
  );
}
