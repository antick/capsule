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
  "keeps a parked %s dock at %i straight despite a saved %s corner",
  async (preset, along, corner) => {
    const settings = {
      ...defaultSettings(),
      autoHide: true,
      topEdgeNotch: false,
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
    const saved = controller.setSettings({
      ...settings,
      cornerArc: true,
      customCorner: corner,
    });
    expect(saved.customCorner).toBeNull();
    expect(saved.cornerArc).toBe(false);
    expect(saved.autoHide).toBe(true);
    await controller.relayout();
    expect(controller.dockFrame().corner).toBeNull();
    // Unrelated updates cannot reactivate the suspended feature.
    controller.setMeterCount(4);
    controller.setSettings({ ...saved, hudTheme: "midnight" });
    await controller.relayout();
    expect(controller.dockFrame().corner).toBeNull();
    expect(controller.dockFrame().hardwareNotch).toBeNull();
  },
);
