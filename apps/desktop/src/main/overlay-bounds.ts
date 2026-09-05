import {
  MOTION,
  type PlacementResult,
  type WindowBox,
  zoomHoldBounds,
} from "@capsule/config";
import type { BrowserWindow } from "electron";

/**
 * Moves the overlay window, holding it at the larger size for the length of a
 * resize so the renderer can ease the artwork between the two without being
 * clipped by its own window. The window is transparent, so nobody sees the
 * slack.
 */
export class BoundsApplier {
  /** Size the window was last laid out for; null until it is first placed. */
  private appliedScale: number | null = null;
  private hold: ReturnType<typeof setTimeout> | null = null;

  apply(
    win: BrowserWindow,
    bounds: WindowBox,
    cardGrowth: PlacementResult["cardGrowth"],
    scale: number,
  ): void {
    if (this.hold) {
      clearTimeout(this.hold);
      this.hold = null;
    }
    const zooming = this.appliedScale !== null && this.appliedScale !== scale;
    this.appliedScale = scale;
    if (!zooming) {
      win.setBounds(bounds, false);
      return;
    }
    win.setBounds(zoomHoldBounds(bounds, win.getBounds(), cardGrowth), false);
    this.hold = setTimeout(() => {
      this.hold = null;
      if (!win.isDestroyed()) {
        win.setBounds(bounds, false);
      }
    }, MOTION.zoomMs + MOTION.zoomSettleMs);
  }
}
