import { HUD, HUD_BASE } from "./constants.ts";

/**
 * The dock is authored once at scale 1 — the size it ships at — and every
 * pixel value is derived from that base, so the whole HUD (rail, meters, card,
 * tail and shadow gutter) grows and shrinks as a single unit.
 */
export const HUD_SCALE = {
  min: 0.7,
  max: 1.3,
  step: 0.1,
  default: 1,
} as const;

/** Every size the stepper can land on, smallest first. */
export function hudScaleSteps(): number[] {
  const count = Math.round((HUD_SCALE.max - HUD_SCALE.min) / HUD_SCALE.step);
  return Array.from({ length: count + 1 }, (_, i) =>
    clampHudScale(HUD_SCALE.min + i * HUD_SCALE.step),
  );
}

/**
 * Holds a scale inside the supported range without rounding it to a step.
 * Settings only ever store a step, but a resize eases through the sizes in
 * between, and those have to be drawable or the animation is a staircase.
 */
export function hudScaleRange(scale: number): number {
  if (!Number.isFinite(scale)) {
    return HUD_SCALE.default;
  }
  return Math.min(HUD_SCALE.max, Math.max(HUD_SCALE.min, scale));
}

/** The nearest size the user can actually choose. */
export function clampHudScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return HUD_SCALE.default;
  }
  const stepped = Math.round(scale / HUD_SCALE.step) * HUD_SCALE.step;
  return hudScaleRange(Number(stepped.toFixed(2)));
}

export function nextHudScale(scale: number, direction: 1 | -1): number {
  return clampHudScale(clampHudScale(scale) + direction * HUD_SCALE.step);
}

export interface HudMetrics {
  /** The user's size preference, where 1 is 100%. */
  scale: number;
  /**
   * The same number, named for what it does: the multiplier applied to every
   * authored dimension, including the few that are not rounded to pixels.
   */
  unit: number;
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
  /** The notch the dock draws for itself where the display has none. */
  notchWidth: number;
  notchDepth: number;
  /** The tab a retracted dock leaves in the screen edge. */
  latchThickness: number;
  latchLength: number;
  /** How far in from the edge that tab answers the mouse. */
  latchReach: number;
  /** How far the meters slide toward the edge as the dock folds away. */
  stowShift: number;
  activitySize: number;
  activityStroke: number;
  cardRule: number;
  cardRuleGap: number;
  cardStatusDot: number;
  cardStatusStroke: number;
  cardStatusGap: number;
  notchBezelFillet: number;
}

/** Keys scaled by {@link hudMetrics}; everything else on HUD is presentational. */
// biome-ignore format: one key per line reads as the checklist it is.
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
  "notchWidth",
  "notchDepth",
  "latchThickness",
  "latchLength",
  "latchReach",
  "stowShift",
  "activitySize",
  "activityStroke",
  "cardRule",
  "cardRuleGap",
  "cardStatusDot",
  "cardStatusStroke",
  "cardStatusGap",
  "notchBezelFillet",
] as const satisfies ReadonlyArray<keyof typeof HUD_BASE>;

/**
 * Rounds to whole pixels so strokes and text stay crisp, but never lets a
 * value collapse to zero when the dock is at its smallest.
 */
function px(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale));
}

export function hudMetrics(scale: number = HUD_SCALE.default): HudMetrics {
  const safe = hudScaleRange(scale);
  const out = { scale: safe, unit: safe } as HudMetrics;
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

/** How many session rows a card shows, and how many it only counts. */
export function sessionRowsShown(count: number): {
  rows: number;
  hidden: number;
} {
  const rows = Math.max(0, Math.min(count, HUD.maxCardSessions));
  return { rows, hidden: Math.max(0, count - rows) };
}

/**
 * The card's height for what it has to show. Worked out here rather than
 * measured, so the window, the hit region and the silhouette can all agree on
 * it before anything is laid out.
 */
export function cardHeightFor(
  m: HudMetrics,
  input: { buckets: number; sessions?: number },
): number {
  let height =
    m.cardPaddingTop + m.cardTitleLine + m.cardTitleGap + m.cardPaddingBottom;
  if (input.buckets <= 0) {
    // A status line instead of the bars.
    height += m.cardTextLine;
  } else {
    const bucket = m.cardTextLine * 2 + m.cardBucketGap * 2 + m.barHeight;
    height += input.buckets * bucket + (input.buckets - 1) * m.cardSectionGap;
  }
  const shown = sessionRowsShown(input.sessions ?? 0);
  if (shown.rows > 0) {
    const row = m.cardTextLine * 2 + m.cardBucketGap;
    height +=
      m.cardRuleGap * 2 +
      m.cardRule +
      shown.rows * row +
      (shown.rows - 1) * m.cardSectionGap;
    if (shown.hidden > 0) {
      height += m.cardSectionGap + m.cardTextLine;
    }
  }
  return height;
}

export function cardHeightForBuckets(m: HudMetrics, count: number): number {
  return cardHeightFor(m, { buckets: Math.max(1, count) });
}

export function cardMessageHeight(m: HudMetrics): number {
  return cardHeightFor(m, { buckets: 0 });
}

/**
 * The tallest card any provider can produce. The window is sized for this
 * once, so a taller-than-usual card is never clipped by the frame it opens
 * inside; being generous costs nothing, since the window is transparent.
 */
export function cardReserveHeight(m: HudMetrics): number {
  return cardHeightFor(m, {
    buckets: HUD.maxCardBuckets,
    sessions: HUD.maxCardSessions + 1,
  });
}

/** The display's own notch, when the dock has to share the bezel with one. */
export interface HardwareNotch {
  width: number;
  height: number;
}

/**
 * The notch to draw on a display that has none of its own: a MacBook's width,
 * and exactly the menu bar's height so the resting tab sits inside the bar
 * the way the real notch does. Hardware sizes are never scaled, but this one
 * is the dock's own, so it grows and shrinks with it.
 */
export function virtualNotch(
  m: HudMetrics,
  menuBarHeight: number,
): HardwareNotch {
  return {
    width: m.notchWidth,
    height: menuBarHeight > 0 ? Math.round(menuBarHeight) : m.notchDepth,
  };
}

/**
 * How long a compact rail has to be when it is drawn as the display's notch.
 * A single ring makes a rail narrower than the hardware, and a bar the same
 * width as the notch is a straight column that appears not to have opened at
 * all. So the floor is the notch plus a corner's worth of opening each side.
 */
export function joinedNotchRailLength(
  m: HudMetrics,
  count: number,
  notch: HardwareNotch,
): number {
  return Math.max(
    railLengthForCount(m, count, true),
    notch.width + 2 * m.notchRadius,
  );
}

/**
 * Extra length at each end of a rail that has been stretched past what its
 * meters need, so the meters — and the tails aimed at them — stay centred.
 */
export function railEndSpread(
  m: HudMetrics,
  count: number,
  compact: boolean,
  railLength: number,
): number {
  return Math.max(0, (railLength - railLengthForCount(m, count, compact)) / 2);
}
