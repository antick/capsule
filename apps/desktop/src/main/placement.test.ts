import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computePlacement, HUD, PLACEMENT } from "@capsule/config";
import { describe, expect, it } from "vitest";

describe("desktop placement wiring", () => {
  it("keeps an expanded right-edge rail flush", () => {
    const result = computePlacement(
      "right-edge",
      {
        display: {
          id: 1,
          bounds: { x: 0, y: 0, width: 1512, height: 982 },
          workArea: { x: 0, y: 38, width: 1512, height: 870 },
        },
        dock: { orientation: "bottom", autohide: false, tilesize: 48 },
        stageManagerEnabled: false,
      },
      {
        railWidth: HUD.railWidth,
        railLength: 280,
        cardWidth: HUD.cardWidth,
        cardHeight: 188,
        expanded: true,
        shadowPadding: HUD.shadowPadding,
        joinWidth: HUD.joinWidth,
      },
      PLACEMENT,
    );
    expect(result.x + result.width).toBe(1512);
    expect(result.cardGrowth).toBe("left");
  });
});

describe("app chrome assets", () => {
  it("includes tray and Dock icons", () => {
    const resources = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../resources",
    );
    expect(existsSync(join(resources, "trayTemplate.png"))).toBe(true);
    expect(existsSync(join(resources, "trayTemplate@2x.png"))).toBe(true);
    expect(existsSync(join(resources, "dock.png"))).toBe(true);
  });
});
