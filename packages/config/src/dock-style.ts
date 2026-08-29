import type { HudMetrics } from "./metrics.ts";

export const DOCK_STYLE_IDS = ["rail", "capsule", "tray"] as const;
export type DockStyleId = (typeof DOCK_STYLE_IDS)[number];

export interface DockStyle {
  id: DockStyleId;
  label: string;
  hint: string;
  /** Concave fillet blending the rail into the screen edge, 0 to disable. */
  flare: number;
  /** Corner radius: `pill` rounds to a half-width, a number scales railRadius. */
  radius: "pill" | number;
  /** Gap left between the dock and the screen edge, scaling shadowPadding. */
  edgeGap: number;
  /** Hairline drawn around the surface. */
  outline: boolean;
}

export const DOCK_STYLES = {
  rail: {
    id: "rail",
    label: "Rail",
    hint: "Melts into the screen edge with a concave fillet at each end.",
    flare: 1,
    radius: 1,
    edgeGap: 0,
    outline: false,
  },
  capsule: {
    id: "capsule",
    label: "Capsule",
    hint: "A floating pill that hovers just clear of the edge.",
    flare: 0,
    radius: "pill",
    edgeGap: 0.5,
    outline: false,
  },
  tray: {
    id: "tray",
    label: "Tray",
    hint: "A rounded panel with a hairline border, like the macOS Dock.",
    flare: 0,
    radius: 0.42,
    edgeGap: 0.45,
    outline: true,
  },
} as const satisfies Record<DockStyleId, DockStyle>;

export function dockStyleFor(id: DockStyleId | string | undefined): DockStyle {
  return DOCK_STYLES[id as DockStyleId] ?? DOCK_STYLES.rail;
}

/** Distance between the dock and the screen edge it is docked against. */
export function dockEdgeGap(m: HudMetrics, style: DockStyle): number {
  if (style.edgeGap <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(m.shadowPadding * style.edgeGap));
}

/** Only the rail style can pass for a notch; the others visibly float. */
export function styleSupportsNotch(style: DockStyle): boolean {
  return style.id === "rail";
}
