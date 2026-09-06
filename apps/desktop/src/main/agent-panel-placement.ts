import { AGENTS, type Rect } from "@capsule/config";

/** Prefer the side with room, and keep the complete input panel on screen. */
export function agentPanelBounds(anchor: Rect, workArea: Rect): Rect {
  const width = Math.min(AGENTS.panelWidth, workArea.width);
  const height = Math.min(AGENTS.panelHeight, workArea.height);
  const leftSpace = anchor.x - workArea.x;
  const rightSpace = workArea.x + workArea.width - anchor.x - anchor.width;
  const desiredX =
    rightSpace >= width + AGENTS.panelGap || rightSpace > leftSpace
      ? anchor.x + anchor.width + AGENTS.panelGap
      : anchor.x - width - AGENTS.panelGap;
  const desiredY = anchor.y + anchor.height / 2 - height / 2;
  return {
    x: Math.round(
      Math.max(
        workArea.x,
        Math.min(desiredX, workArea.x + workArea.width - width),
      ),
    ),
    y: Math.round(
      Math.max(
        workArea.y,
        Math.min(desiredY, workArea.y + workArea.height - height),
      ),
    ),
    width,
    height,
  };
}
