import { AGENTS } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { agentPanelBounds } from "./agent-panel-placement.ts";

describe("agent panel placement", () => {
  it("fits all four edges and corners, including a monitor with negative coordinates", () => {
    for (const work of [
      { x: 0, y: 25, width: 1440, height: 875 },
      { x: -1920, y: -500, width: 1920, height: 1055 },
    ]) {
      for (const x of [
        work.x,
        work.x + work.width / 2,
        work.x + work.width - 32,
      ]) {
        for (const y of [
          work.y,
          work.y + work.height / 2,
          work.y + work.height - 32,
        ]) {
          const panel = agentPanelBounds({ x, y, width: 32, height: 32 }, work);
          expect(panel.x).toBeGreaterThanOrEqual(work.x);
          expect(panel.y).toBeGreaterThanOrEqual(work.y);
          expect(panel.x + panel.width).toBeLessThanOrEqual(
            work.x + work.width,
          );
          expect(panel.y + panel.height).toBeLessThanOrEqual(
            work.y + work.height,
          );
          expect(panel.width).toBe(AGENTS.panelWidth);
        }
      }
    }
  });
  it("shrinks to an unusually small work area", () => {
    expect(
      agentPanelBounds(
        { x: 0, y: 0, width: 32, height: 32 },
        { x: 0, y: 0, width: 300, height: 400 },
      ),
    ).toEqual({ x: 0, y: 0, width: 300, height: 400 });
  });
});
