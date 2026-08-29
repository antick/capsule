import { app } from "electron";

/**
 * Capsule is the menu-bar extra and the HUD. A macOS Dock tile is a second
 * copy of the same process.
 *
 * `app.dock.hide()` is the wrong tool: Electron ignores a second hide within
 * one second, and creating or focusing a regular window (settings, onboarding)
 * promotes the process back to a normal app and puts the tile back. Accessory
 * policy is the LSUIElement equivalent and is what actually keeps us out.
 *
 * Setting accessory policy while the app is already active deactivates it, so
 * this is a no-op when the tile is already gone.
 */
export function hideFromMacDock(): void {
  if (process.platform !== "darwin") {
    return;
  }
  if (app.dock?.isVisible() === false) {
    return;
  }
  app.setActivationPolicy("accessory");
}
