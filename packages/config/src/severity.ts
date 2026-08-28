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
