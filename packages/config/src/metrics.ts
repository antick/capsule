import { HUD_BASE } from "./constants.ts";

/**
 * The dock is authored once at scale 1 and every pixel value is derived from
 * that base, so the whole HUD — rail, meters, card, tail and shadow gutter —
 * grows and shrinks as a single unit.
 */
export const HUD_SCALE = {
  min: 0.55,
  max: 1.2,
  step: 0.05,
  default: 0.75,
} as const;

export function clampHudScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return HUD_SCALE.default;
  }
  const stepped = Math.round(scale / HUD_SCALE.step) * HUD_SCALE.step;
  return Math.min(
    HUD_SCALE.max,
    Math.max(HUD_SCALE.min, Number(stepped.toFixed(2))),
  );
}

export function nextHudScale(scale: number, direction: 1 | -1): number {
  return clampHudScale(clampHudScale(scale) + direction * HUD_SCALE.step);
}

export interface HudMetrics {
  scale: number;
  railWidth: number;
  railPaddingX: number;
  railPaddingY: number;
  railRadius: number;
  edgeFlare: number;
  meterSize: number;
  ringStroke: number;
  iconSize: number;
  meterLabelGap: number;
  percentBlock: number;
  percentFontSize: number;
  itemGap: number;
  cardWidth: number;
  cardRadius: number;
  cardPaddingX: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardTitleSize: number;
  cardTitleLine: number;
  cardTitleGap: number;
  cardIconSize: number;
  cardIconGap: number;
  cardLabelSize: number;
  cardResetSize: number;
  cardResetGap: number;
  cardTextLine: number;
  cardBucketGap: number;
  cardSectionGap: number;
  barHeight: number;
  tailBase: number;
  tailLength: number;
  joinGap: number;
  shadowPadding: number;
  /** Corner radius used when the dock renders as a screen-top notch. */
  notchRadius: number;
  /** Along-axis padding inside the notch, which is tighter than the rail. */
  notchPaddingY: number;
}

/** Keys scaled by {@link hudMetrics}; everything else on HUD is presentational. */
const SCALED_KEYS = [
  "railWidth",
  "railPaddingX",
  "railPaddingY",
  "railRadius",
  "edgeFlare",
  "meterSize",
  "ringStroke",
  "iconSize",
  "meterLabelGap",
  "percentBlock",
  "percentFontSize",
  "itemGap",
  "cardWidth",
  "cardRadius",
  "cardPaddingX",
  "cardPaddingTop",
  "cardPaddingBottom",
  "cardTitleSize",
  "cardTitleLine",
  "cardTitleGap",
  "cardIconSize",
  "cardIconGap",
  "cardLabelSize",
  "cardResetSize",
  "cardResetGap",
  "cardTextLine",
  "cardBucketGap",
  "cardSectionGap",
  "barHeight",
  "tailBase",
  "tailLength",
  "joinGap",
  "shadowPadding",
  "notchRadius",
  "notchPaddingY",
] as const satisfies ReadonlyArray<keyof typeof HUD_BASE>;

/**
 * Rounds to whole pixels so strokes and text stay crisp, but never lets a
 * value collapse to zero when the dock is at its smallest.
 */
function px(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale));
}

export function hudMetrics(scale: number = HUD_SCALE.default): HudMetrics {
  const safe = clampHudScale(scale);
  const out = { scale: safe } as HudMetrics;
  for (const key of SCALED_KEYS) {
    out[key] = px(HUD_BASE[key], safe);
  }
  return out;
}

export function meterBlockSize(m: HudMetrics, compact = false): number {
  if (compact) {
    return m.meterSize;
  }
  return m.meterSize + m.meterLabelGap + m.percentBlock;
}

export function meterStrideSize(m: HudMetrics, compact = false): number {
  return meterBlockSize(m, compact) + m.itemGap;
}

export function railLengthForCount(
  m: HudMetrics,
  count: number,
  compact = false,
): number {
  const n = Math.max(1, count);
  const padding = compact ? m.notchPaddingY : m.railPaddingY;
  return padding * 2 + n * meterBlockSize(m, compact) + (n - 1) * m.itemGap;
}

export function joinOffsetForIndex(
  m: HudMetrics,
  index: number,
  compact = false,
): number {
  const padding = compact ? m.notchPaddingY : m.railPaddingY;
  return padding + index * meterStrideSize(m, compact) + m.meterSize / 2;
}

export function cardHeightForBuckets(m: HudMetrics, count: number): number {
  const rows = Math.max(1, count);
  const bucket = m.cardTextLine * 2 + m.cardBucketGap * 2 + m.barHeight;
  return (
    m.cardPaddingTop +
    m.cardTitleLine +
    m.cardTitleGap +
    rows * bucket +
    (rows - 1) * m.cardSectionGap +
    m.cardPaddingBottom
  );
}

export function cardMessageHeight(m: HudMetrics): number {
  return (
    m.cardPaddingTop +
    m.cardTitleLine +
    m.cardTitleGap +
    m.cardTextLine +
    m.cardPaddingBottom
  );
}
