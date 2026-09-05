import { IPC, MOTION, type Rect } from "@capsule/config";
import { type BrowserWindow, screen } from "electron";

/**
 * Decides when the overlay swallows the mouse.
 *
 * The renderer cannot: macOS only forwards move events to a click-through
 * window while the owning app is frontmost, so with another app in focus the
 * overlay would never learn the cursor had arrived and would stay transparent
 * to it forever. Instead the cursor is read here and hit-tested against the
 * regions the renderer publishes.
 */
export class HoverTracker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ignoreMouse = true;
  /** Window-local areas the dock wants the mouse for, reported by the renderer. */
  private hitRegions: Rect[] = [];

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    /** A press or a drag owns the mouse until it ends, whatever it is over. */
    private readonly isOwned: () => boolean,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.update();
    }, MOTION.hoverPollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setHitRegions(regions: Rect[]): void {
    this.hitRegions = regions;
    this.update();
  }

  update(): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) {
      return;
    }
    // The dock may well have slid out from under a held pointer.
    if (this.isOwned()) {
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

  setIgnore(ignore: boolean): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) {
      return;
    }
    if (this.ignoreMouse === ignore) {
      return;
    }
    this.ignoreMouse = ignore;
    win.setIgnoreMouseEvents(ignore, { forward: true });
    // Going click-through does not raise pointerout in the renderer, so a dock
    // that opened a card would sit there with it open for good. The hit test
    // already knows the cursor has gone; say so.
    win.webContents.send(IPC.pointerInside, !ignore);
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
