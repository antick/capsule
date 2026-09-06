import {
  type CapsuleSettings,
  type ChromeSnapshot,
  type Corner,
  dockAlongEdge,
  dockStyleFor,
  type HardwareNotch,
  HUD,
  hudMetrics,
  IPC,
  MOTION,
  nearestEdgeForPoint,
  type PlacementPreset,
  type PlacementResult,
  type ProviderId,
  presetForEdge,
  type Rect,
  railStartForCorner,
  slideAlongEdge,
  styleSupportsNotch,
  virtualNotch,
} from "@capsule/config";
import { type BrowserWindow, type Display, screen } from "electron";
import { readChromeSnapshot } from "./chrome.ts";
import { HardwareNotchReader } from "./hardware-notch.ts";
import { BoundsApplier } from "./overlay-bounds.ts";
import {
  createOverlayBrowserWindow,
  MENU_SAFE_LEVEL,
  TOP_LEVEL,
} from "./overlay-browser-window.ts";
import { HoverTracker } from "./overlay-hover.ts";
import {
  computeDockPlacement,
  cornerForPlacement,
  curlsIntoCorners,
  describeDisplay,
  displayFor,
  railStartOf,
  syntheticChromeFor,
  windowBoxOf,
} from "./overlay-placement.ts";
import { rendererDevUrl, rendererHtml } from "./paths.ts";

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
  private pressed = false;
  private hover = new HoverTracker(
    () => this.window,
    () => this.pressed || this.drag !== null,
  );
  private onPresetPreview: ((preset: PlacementPreset) => void) | null = null;
  /** Where the rail currently sits inside the window. */
  private railBias = 0;
  /** Corner the dock has curled into, or null while it lies along an edge. */
  private corner: Corner | null = null;
  /**
   * The notch the dock is drawn as, while it is on the top edge in notch
   * style: the display's own where it has one, otherwise one the dock draws
   * for itself in the menu bar. Null everywhere else.
   */
  private hardwareNotch: HardwareNotch | null = null;
  private notchReader = new HardwareNotchReader();
  /** What the renderer was last told, so a drag does not spam identical values. */
  private publishedFrame: string | null = null;
  private bounds = new BoundsApplier();

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

    const win = createOverlayBrowserWindow();

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
    this.hover.start();
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
    this.hover.setHitRegions(regions);
  }

  /** Held from pointerdown to pointerup: never go click-through mid-press. */
  setPressed(pressed: boolean): void {
    this.pressed = pressed;
    if (pressed) {
      this.hover.setIgnore(false);
    } else {
      this.hover.update();
    }
  }

  setExpanded(_open: boolean, _providerId: ProviderId | null): void {
    // Window stays card-sized so the bubble can animate without clipping.
  }

  /** Unrolls a hidden dock and holds it out, so it can be found again. */
  reveal(): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    if (!win.isVisible()) {
      win.showInactive();
    }
    win.webContents.send(IPC.revealDock);
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
      syntheticChromeFor(this.currentDisplay()),
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
    this.hover.setIgnore(false);
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
    customCorner: Corner | null;
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
      customCorner: this.corner,
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
    this.hover.stop();
  }

  async relayout(): Promise<PlacementResult | null> {
    const win = this.window;
    if (!win || win.isDestroyed() || this.drag) {
      return null;
    }
    const preset = this.settings.placementPreset;
    const chrome = await this.chromeFor(preset);
    this.hardwareNotch = await this.joinedNotchFor(preset);
    const edge = this.computeFor(preset, chrome, null);
    this.settingsDisplayId = edge.displayId;

    // Drawn as the display's notch, the dock stays over the display's notch:
    // a remembered offset would leave a black bar beside the real one.
    const custom = this.hardwareNotch ? null : this.settings.customPosition;
    // A remembered position only says how far along the edge the rail sits;
    // the axis pinned to the edge always comes from the placement.
    const railStart = custom
      ? edge.slide.axis === "x"
        ? custom.x
        : custom.y
      : railStartOf(edge);
    // The corner is the one the dock was dropped into, not one worked out
    // from where the rail happens to sit: a rail that grew a ring used to
    // reach the end of its track and curl up uninvited.
    const corner =
      this.hardwareNotch || !curlsIntoCorners(this.settings)
        ? null
        : this.settings.customCorner;
    const placement = corner
      ? this.computeFor(preset, chrome, corner)
      : this.slid(edge, railStart);

    const bounds = {
      x: Math.round(placement.x),
      y: Math.round(placement.y),
      width: Math.round(placement.width),
      height: Math.round(placement.height),
    };
    this.bounds.apply(
      win,
      bounds,
      placement.cardGrowth,
      this.settings.hudScale,
    );
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

  /** How the overlay should currently draw itself, for a renderer that asks. */
  dockFrame(): {
    railBias: number;
    corner: Corner | null;
    hardwareNotch: HardwareNotch | null;
  } {
    return {
      railBias: this.railBias,
      corner: this.corner,
      hardwareNotch: this.hardwareNotch,
    };
  }

  /** The display set changed; ask AppKit about notches again next time. */
  invalidateHardwareNotch(): void {
    this.notchReader.invalidate();
  }

  /**
   * The notch to draw as, if any: only the top edge, in notch style, in a dock
   * style that can pass for one. A display with a notch of its own lends its
   * exact size, so the two merge; any other display gets a notch the dock
   * draws for itself, sized to the menu bar it sits in.
   */
  private async joinedNotchFor(
    preset: PlacementPreset,
  ): Promise<HardwareNotch | null> {
    if (preset !== "top-edge" || !this.settings.topEdgeNotch) {
      return null;
    }
    if (!styleSupportsNotch(dockStyleFor(this.settings.dockStyle))) {
      return null;
    }
    const display = this.currentDisplay();
    const hardware = await this.notchReader.read({
      id: display.id,
      bounds: display.bounds,
    });
    return (
      hardware ??
      virtualNotch(
        hudMetrics(this.settings.hudScale),
        display.workArea.y - display.bounds.y,
      )
    );
  }

  /** Tells the renderer how to draw itself in the window it was just given. */
  private publishFrame(bias: number, corner: Corner | null): void {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return;
    }
    const frame = {
      railBias: Math.round(bias),
      corner,
      hardwareNotch: this.hardwareNotch,
    };
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
  private currentDisplay(): Display {
    return displayFor(this.settingsDisplayId);
  }

  private chromeFor(_preset: PlacementPreset): Promise<ChromeSnapshot> {
    return readChromeSnapshot(describeDisplay(this.currentDisplay()));
  }

  private computeFor(
    preset: PlacementPreset,
    chrome: ChromeSnapshot,
    corner: Corner | null,
  ): PlacementResult {
    return computeDockPlacement({
      settings: this.settings,
      meterCount: this.meterCount,
      hardwareNotch: this.hardwareNotch,
      preset,
      chrome,
      corner,
    });
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
      placement = this.computeFor(
        preset,
        syntheticChromeFor(this.currentDisplay()),
        null,
      );
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
    const corner = cornerForPlacement(this.settings, placement, next.railStart);
    const curled = corner
      ? this.computeFor(
          preset,
          syntheticChromeFor(this.currentDisplay()),
          corner,
        )
      : null;
    win.setBounds(
      curled
        ? windowBoxOf(curled)
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

  private stopDragPoll(): void {
    if (this.dragTimer) {
      clearInterval(this.dragTimer);
      this.dragTimer = null;
    }
  }
}
