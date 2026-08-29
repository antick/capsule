import { afterEach, describe, expect, it, vi } from "vitest";

const electronApp = vi.hoisted(() => ({
  isVisible: vi.fn(() => true),
  setActivationPolicy: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    dock: {
      isVisible: electronApp.isVisible,
      hide: vi.fn(),
    },
    setActivationPolicy: electronApp.setActivationPolicy,
  },
}));

import { hideFromMacDock } from "./macos-dock.ts";

describe("hideFromMacDock", () => {
  const platform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: platform });
    electronApp.isVisible.mockReset();
    electronApp.isVisible.mockReturnValue(true);
    electronApp.setActivationPolicy.mockReset();
  });

  it("sets accessory policy while the Dock tile is showing", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    electronApp.isVisible.mockReturnValue(true);
    hideFromMacDock();
    expect(electronApp.setActivationPolicy).toHaveBeenCalledWith("accessory");
  });

  it("does not change policy when the tile is already gone", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    electronApp.isVisible.mockReturnValue(false);
    hideFromMacDock();
    expect(electronApp.setActivationPolicy).not.toHaveBeenCalled();
  });

  it("does nothing off macOS", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    hideFromMacDock();
    expect(electronApp.setActivationPolicy).not.toHaveBeenCalled();
  });
});
