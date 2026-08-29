import { afterEach, describe, expect, it, vi } from "vitest";

const electronApp = vi.hoisted(() => ({
  setActivationPolicy: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    setActivationPolicy: electronApp.setActivationPolicy,
  },
}));

import { hideFromMacDock } from "./macos-dock.ts";

describe("hideFromMacDock", () => {
  const platform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: platform });
    electronApp.setActivationPolicy.mockReset();
  });

  it("sets accessory policy on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    hideFromMacDock();
    expect(electronApp.setActivationPolicy).toHaveBeenCalledWith("accessory");
  });

  it("does nothing off macOS", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    hideFromMacDock();
    expect(electronApp.setActivationPolicy).not.toHaveBeenCalled();
  });
});
