import { defaultSettings, type PlacementPreset } from "@capsule/config";
import type { BrowserWindow } from "electron";
import { expect, it, vi } from "vitest";

const { display } = vi.hoisted(() => ({
  display: {
    id: 7,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 25, width: 1920, height: 1055 },
  },
}));
vi.mock("electron", () => ({
  screen: {
    getAllDisplays: () => [display],
    getPrimaryDisplay: () => display,
  },
}));
vi.mock("./chrome.ts", () => ({
  readChromeSnapshot: async () => ({
    display,
    dock: { orientation: "bottom", autohide: false, tilesize: 48 },
  }),
}));
vi.mock("./overlay-browser-window.ts", () => ({}));

import { OverlayController } from "./overlay-window.ts";

it.each([
  ["right-edge", 0, "top-right"],
  ["right-edge", 10000, "bottom-right"],
  ["left-edge", 0, "top-left"],
  ["left-edge", 10000, "bottom-left"],
  ["top-edge", 0, "top-left"],
  ["top-edge", 10000, "top-right"],
] as const)(
  "curls an already parked %s dock at %i into %s",
  async (preset, along, corner) => {
    const settings = {
      ...defaultSettings(),
      autoHide: true,
      placementPreset: preset as PlacementPreset,
      customPosition: { x: along, y: along },
    };
    const controller = new OverlayController(settings);
    controller.window = {
      isDestroyed: () => false,
      setBounds: vi.fn(),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow;
    expect(controller.dockFrame().corner).toBeNull();
    const saved = controller.setSettings({ ...settings, cornerArc: true });
    expect(saved.customCorner).toBe(corner);
    expect(saved.autoHide).toBe(true);
    await controller.relayout();
    expect(controller.dockFrame().corner).toBe(corner);
    // Unrelated updates keep the chosen corner, and the notch cannot recenter it.
    controller.setMeterCount(4);
    controller.setSettings({ ...saved, hudTheme: "midnight" });
    await controller.relayout();
    expect(controller.dockFrame().corner).toBe(corner);
    expect(controller.dockFrame().hardwareNotch).toBeNull();
  },
);
