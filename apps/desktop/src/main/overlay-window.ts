import { join } from "node:path";
import {
  APP_NAME,
  type CapsuleSettings,
  type Corner,
  cardHeightForBuckets,
  computePlacement,
  cornerForRail,
  cornerWindowSize,
  dockAlongEdge,
  dockEdgeGap,
  dockStyleFor,
  HUD,
  hudMetrics,
  IPC,
  MOTION,
  nearestEdgeForPoint,
  PLACEMENT,
  type PlacementPreset,
  type PlacementResult,
  type ProviderId,
  presetForEdge,
  type Rect,
  railLengthForCount,
  railStartForCorner,
  slideAlongEdge,
  styleSupportsNotch,
  type WindowBox,
  zoomHoldBounds,
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
  /** The edge placement, corner-free: the drag measures against its track. */
  placement: PlacementResult;
  /** Cursor offset from the leading edge of the rail, along the slide axis. */
  grabOffset: number;
  /** Leading edge of the rail in screen coordinates, which is what we store. */
  railStart: number;
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
  /** Where the rail currently sits inside the window. */
  private railBias = 0;
  /** Corner the dock has curled into, or null while it lies along an edge. */
  private corner: Corner | null = null;
  /** What the renderer was last told, so a drag does not spam identical values. */
  private publishedFrame: string | null = null;
  /** Size the window was last laid out for; null until it is first placed. */
  private appliedScale: number | null = null;
  private zoomHold: ReturnType<typeof setTimeout> | null = null;

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

    this.window = win;
    await this.relayout();

    win.webContents.on("did-finish-load", () => {
      // A fresh renderer knows nothing about the layout it was sized for.
      this.publishedFrame = null;
      this.publishFrame(this.railBias, this.corner);
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
    const placement = this.computeFor(
      this.settings.placementPreset,
      this.syntheticChrome(),
      null,
    );
    // Grab the rail, not the window: where the window has been stopped by a
    // screen edge the two no longer move together. A curled dock has no rail
    // to grab, so it re-enters the track at the end it curled from.
    const windowStart = placement.slide.axis === "x" ? bounds.x : bounds.y;
    const railStart = this.corner
      ? railStartForCorner(placement.slide, this.corner)
      : windowStart + placement.slide.gutter + this.railBias;
    this.drag = {
      preset: this.settings.placementPreset,
      placement,
      grabOffset:
        (placement.slide.axis === "x" ? screenX : screenY) - railStart,
      railStart,
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
    // The slide axis holds the rail's leading edge, so the same number means
    // the same place whatever the card or the style does to the window around
    // it. The other axis is pinned by the edge and is ignored on the way back.
    const along = Math.round(drag.railStart);
    return {
      placementPreset: drag.preset,
      customPosition:
        drag.placement.slide.axis === "x"
          ? { x: along, y: bounds.y }
          : { x: bounds.x, y: along },
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
    const preset = this.settings.placementPreset;
    const chrome = await this.chromeFor(preset);
    const edge = this.computeFor(preset, chrome, null);
    this.settingsDisplayId = edge.displayId;

    const custom = this.settings.customPosition;
    // A remembered position only says how far along the edge the rail sits;
    // the axis pinned to the edge always comes from the placement.
    const railStart = custom
      ? edge.slide.axis === "x"
        ? custom.x
        : custom.y
      : this.railStartOf(edge);
    const corner = this.cornerFor(edge, railStart);
    const placement = corner
      ? this.computeFor(preset, chrome, corner)
      : this.slid(edge, railStart);

    const bounds = {
      x: Math.round(placement.x),
      y: Math.round(placement.y),
      width: Math.round(placement.width),
      height: Math.round(placement.height),
    };
    this.applyBounds(win, bounds, placement.cardGrowth);
    this.publishFrame(placement.railBias, corner);
    return { ...placement, x: bounds.x, y: bounds.y };
  }

  /** The same placement, moved so its rail starts where it is asked to. */
  private slid(placement: PlacementResult, railStart: number): PlacementResult {
    const placed = dockAlongEdge(placement.slide, railStart);
    return {
      ...placement,
      x: placement.slide.axis === "x" ? placed.window : placement.x,
      y: placement.slide.axis === "y" ? placed.window : placement.y,
      railBias: placed.railBias,
    };
  }

  /**
   * Moves the window, holding it at the larger size for the length of a resize
   * so the renderer can ease the artwork between the two without being clipped
   * by its own window. The window is transparent, so nobody sees the slack.
   */
  private applyBounds(
    win: BrowserWindow,
    bounds: WindowBox,
    cardGrowth: PlacementResult["cardGrowth"],
  ): void {
    if (this.zoomHold) {
      clearTimeout(this.zoomHold);
      this.zoomHold = null;
    }
    const zooming =
      this.appliedScale !== null &&
      this.appliedScale !== this.settings.hudScale;
    this.appliedScale = this.settings.hudScale;
    if (!zooming) {
      win.setBounds(bounds, false);
      return;
    }
    win.setBounds(zoomHoldBounds(bounds, win.getBounds(), cardGrowth), false);
    this.zoomHold = setTimeout(() => {
      this.zoomHold = null;
      if (!win.isDestroyed()) {
        win.setBounds(bounds, false);
      }
    }, MOTION.zoomMs + MOTION.zoomSettleMs);
  }

  /** How the overlay should currently draw itself, for a renderer that asks. */
  dockFrame(): { railBias: number; corner: Corner | null } {
    return { railBias: this.railBias, corner: this.corner };
  }

  /** Tells the renderer how to draw itself in the window it was just given. */
  private publishFrame(bias: number, corner: Corner | null): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    const frame = { railBias: Math.round(bias), corner };
    this.railBias = frame.railBias;
    this.corner = corner;
    const key = JSON.stringify(frame);
    if (this.publishedFrame === key) {
      return;
    }
    this.publishedFrame = key;
    win.webContents.send(IPC.dockFrame, frame);
  }

  /**
   * The corner the rail has reached, if the arc is switched on. Derived from
   * where the rail sits rather than stored, so a corner dock uncurls by itself
   * when the screen it is on changes size.
   */
  private cornerFor(edge: PlacementResult, railStart: number): Corner | null {
    if (!this.settings.cornerArc) {
      return null;
    }
    return cornerForRail(
      edge.edge,
      edge.slide,
      railStart,
      PLACEMENT.cornerSnapPx,
    );
  }

  /** Where the rail's leading edge sits, given a placement's own window. */
  private railStartOf(placement: PlacementResult): number {
    const axis = placement.slide.axis === "x" ? placement.x : placement.y;
    return axis + placement.slide.gutter + placement.railBias;
  }

  /** The display the dock currently lives on, without asking the system Dock. */
  private syntheticChrome(): Parameters<typeof computePlacement>[1] {
    const display = this.currentDisplay();
    return {
      display: {
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
      },
      // Dock metrics only matter for the bottom preset, and the work-area
      // inset already tells us the Dock's thickness during a drag.
      dock: { orientation: "bottom", autohide: false, tilesize: 48 },
    };
  }

  private currentDisplay() {
    const displays = screen.getAllDisplays();
    return (
      displays.find((item) => item.id === this.settingsDisplayId) ??
      screen.getPrimaryDisplay()
    );
  }

  private async chromeFor(
    _preset: PlacementPreset,
  ): Promise<Parameters<typeof computePlacement>[1]> {
    const display = this.currentDisplay();
    return readChromeSnapshot({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
    });
  }

  private computeFor(
    preset: PlacementPreset,
    chrome: Parameters<typeof computePlacement>[1],
    corner: Corner | null,
  ): PlacementResult {
    const metrics = hudMetrics(this.settings.hudScale);
    const style = dockStyleFor(this.settings.dockStyle);
    const notchAllowed = styleSupportsNotch(style);
    // Matches UsageDock: a dock lying along an edge drops its percent
    // captions, which makes its rail shorter than a vertical one. An arc drops
    // them too, so a corner dock measures as a compact one.
    const compact =
      corner !== null || preset === "top-edge" || preset === "bottom-edge";
    const cardHeight = cardHeightForBuckets(metrics, HUD.maxCardBuckets);
    return computePlacement(
      preset,
      chrome,
      {
        railWidth: metrics.railWidth,
        railLength: railLengthForCount(metrics, this.meterCount, compact),
        cardWidth: metrics.cardWidth,
        // Sized for the tallest card, since the window cannot resize itself
        // mid-animation without the bubble tearing.
        cardHeight,
        expanded: true,
        shadowPadding: metrics.shadowPadding,
        joinWidth: metrics.tailLength + metrics.joinGap,
        edgeFlare: metrics.edgeFlare * style.flare,
        edgeGap: dockEdgeGap(metrics, style),
        corner: cornerWindowSize(metrics, {
          meterCount: this.meterCount,
          cardHeight,
          style,
        }),
      },
      PLACEMENT,
      { notchAllowed, corner },
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
      placement = this.computeFor(preset, this.syntheticChrome(), null);
      // Re-grab the rail from its middle so the dock does not lurch when it
      // rotates onto a new edge.
      drag.grabOffset = placement.slide.railLength / 2;
      drag.preset = preset;
      drag.placement = placement;
      this.onPresetPreview?.(preset);
    }

    const next = slideAlongEdge({
      slide: placement.slide,
      anchorX: placement.x,
      anchorY: placement.y,
      cursor,
      grabOffset: drag.grabOffset,
    });
    drag.railStart = next.railStart;
    const corner = this.cornerFor(placement, next.railStart);
    const curled = corner
      ? this.computeFor(preset, this.syntheticChrome(), corner)
      : null;
    win.setBounds(
      curled
        ? {
            x: Math.round(curled.x),
            y: Math.round(curled.y),
            width: Math.round(curled.width),
            height: Math.round(curled.height),
          }
        : {
            x: next.x,
            y: next.y,
            width: Math.round(placement.width),
            height: Math.round(placement.height),
          },
      false,
    );
    this.publishFrame(curled ? 0 : next.railBias, corner);
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
