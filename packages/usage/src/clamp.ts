export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export function toPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  if (value > 0 && value < 1) {
    return clampPercent(value * 100);
  }
  return clampPercent(value);
}
