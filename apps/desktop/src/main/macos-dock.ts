import { app } from "electron";

/**
 * Capsule is the menu-bar extra and the HUD. A macOS Dock tile is a second
 * copy of the same process.
 *
 * Accessory policy is the LSUIElement equivalent. `app.dock.hide()` is not
 * used: Electron ignores a second hide within one second, and
 * `setVisibleOnAllWorkspaces` used to call `dock.show()` unless the overlay
 * skips the process-type transform.
 */
export function hideFromMacDock(): void {
  if (process.platform !== "darwin") {
    return;
  }
  app.setActivationPolicy("accessory");
}
