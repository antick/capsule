import { type HudMetrics, type HudTheme, MOTION } from "@capsule/config";

/**
 * The dock's drop shadow, as a CSS filter. Two casts rather than one: a tight
 * contact shadow that reads as the surface meeting the desktop, and a wider
 * ambient one at low alpha. A single heavy cast smears a grey cloud over
 * whatever sits behind the dock, which is glaring against a pale window.
 *
 * Both scale with the dock, so the lighting stays the same at every size.
 */
export function dockShadow(m: HudMetrics, theme: HudTheme): string {
  const px = (value: number) => Math.round(value * m.unit);
  return [
    `drop-shadow(0 ${px(MOTION.shadowContactDy)}px ${px(
      MOTION.shadowContactBlur,
    )}px ${theme.shadowContact})`,
    `drop-shadow(0 ${px(MOTION.shadowDy)}px ${px(MOTION.shadowBlur)}px ${
      theme.shadow
    })`,
  ].join(" ");
}
