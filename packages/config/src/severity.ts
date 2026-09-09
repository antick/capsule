import { SEVERITY_BANDS, type Severity } from "./constants.ts";

export function severityForPercent(percent: number): Severity {
  if (percent <= SEVERITY_BANDS.low) {
    return "low";
  }
  if (percent <= SEVERITY_BANDS.mid) {
    return "mid";
  }
  if (percent <= SEVERITY_BANDS.high) {
    return "high";
  }
  return "critical";
}

/**
 * The same four bands, as the settings shell's own tones. The dock's severity
 * colours are drawn for a black surface — pure #00F58A and #E8F50A vanish on a
 * white panel — so anything outside the dock asks for the band, not the hex.
 *
 * Paired with `StatusTone` in `@capsule/ui`, which owns how each one looks.
 */
export const SEVERITY_TONES = {
  low: "good",
  mid: "warn",
  high: "bad",
  critical: "bad",
} as const satisfies Record<Severity, "good" | "warn" | "bad">;

export function severityTone(percent: number): "good" | "warn" | "bad" {
  return SEVERITY_TONES[severityForPercent(percent)];
}
