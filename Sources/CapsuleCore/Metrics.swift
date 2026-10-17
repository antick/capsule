import Foundation

/// The sizes the dock can be drawn at. The stepper only ever stores a step;
/// a resize eases through the values in between.
public enum HudScale {
  public static let min = 0.7
  public static let max = 1.3
  public static let step = 0.1
  public static let `default` = 1.0
}

/// Card limits: how much a single card can be asked to show.
public enum HudLimits {
  public static let maxCardBuckets = 3
  public static let maxCardSessions = 4
}

/// Holds a scale inside the supported range without rounding it to a step,
/// so a resize can ease through the sizes in between instead of a staircase.
public func hudScaleRange(_ scale: Double) -> Double {
  guard scale.isFinite else { return HudScale.default }
  return Swift.min(HudScale.max, Swift.max(HudScale.min, scale))
}

/// The nearest size the user can actually choose.
public func clampHudScale(_ scale: Double) -> Double {
  guard scale.isFinite else { return HudScale.default }
  let stepped = jsRound(scale / HudScale.step) * HudScale.step
  return hudScaleRange(jsFixed2(stepped))
}

public func nextHudScale(_ scale: Double, direction: Int) -> Double {
  clampHudScale(clampHudScale(scale) + Double(direction) * HudScale.step)
}

/// Every size the stepper can land on, smallest first.
public func hudScaleSteps() -> [Double] {
  let count = Int(jsRound((HudScale.max - HudScale.min) / HudScale.step))
  return (0...count).map {
    clampHudScale(HudScale.min + Double($0) * HudScale.step)
  }
}

/// Every pixel size at `scale`, held inside the supported range. Each is
/// rounded to a whole pixel and never shrinks to nothing.
public func hudMetrics(_ scale: Double = HudScale.default) -> HudMetrics {
  let safe = hudScaleRange(scale)
  var metrics = HudMetrics()
  metrics.scale = safe
  metrics.unit = safe
  for (key, authored) in HudMetrics.authored {
    metrics[keyPath: key] = Swift.max(1, jsRound(authored * safe))
  }
  return metrics
}

// MARK: - Rail

public func meterBlockSize(_ m: HudMetrics, compact: Bool = false) -> Double {
  compact ? m.meterSize : m.meterSize + m.meterLabelGap + m.percentBlock
}

public func meterStrideSize(_ m: HudMetrics, compact: Bool = false) -> Double {
  meterBlockSize(m, compact: compact) + m.itemGap
}

/// No meters still lays out one: an empty rail is never zero-length.
public func railLengthForCount(
  _ m: HudMetrics, _ count: Int, compact: Bool = false
) -> Double {
  let n = Double(Swift.max(1, count))
  let padding = compact ? m.notchPaddingY : m.railPaddingY
  return padding * 2 + n * meterBlockSize(m, compact: compact)
    + (n - 1) * m.itemGap
}

/// Where along the rail the tail aims for the meter at `index`.
public func joinOffsetForIndex(
  _ m: HudMetrics, _ index: Int, compact: Bool = false
) -> Double {
  let padding = compact ? m.notchPaddingY : m.railPaddingY
  return padding + Double(index) * meterStrideSize(m, compact: compact)
    + m.meterSize / 2
}

// MARK: - Card

/// How many session rows a card shows, and how many it only counts.
public struct SessionRows: Sendable, Codable, Equatable {
  public var rows: Int
  public var hidden: Int
}

public func sessionRowsShown(_ count: Int) -> SessionRows {
  let rows = Swift.max(0, Swift.min(count, HudLimits.maxCardSessions))
  return SessionRows(rows: rows, hidden: Swift.max(0, count - rows))
}

/// The card's height for what it has to show. Worked out rather than
/// measured, so the window, the hit region and the silhouette agree on it
/// before anything is laid out.
public func cardHeightFor(
  _ m: HudMetrics, buckets: Int, sessions: Int = 0, tokens: Bool = false
) -> Double {
  var height =
    m.cardPaddingTop + m.cardTitleLine + m.cardTitleGap + m.cardPaddingBottom
  if buckets <= 0 {
    // A status line instead of the bars.
    height += m.cardTextLine
  } else {
    let bucket = m.cardTextLine * 2 + m.cardBucketGap * 2 + m.barHeight
    height += Double(buckets) * bucket + Double(buckets - 1) * m.cardSectionGap
  }
  if tokens {
    // A heading and two rows, one line each.
    height += m.cardSectionGap + m.cardTextLine * 3 + m.cardBucketGap * 2
  }
  let shown = sessionRowsShown(sessions)
  if shown.rows > 0 {
    let row = m.cardTextLine * 2 + m.cardBucketGap
    height +=
      m.cardRuleGap * 2 + m.cardRule + Double(shown.rows) * row
      + Double(shown.rows - 1) * m.cardSectionGap
    if shown.hidden > 0 {
      height += m.cardSectionGap + m.cardTextLine
    }
  }
  return height
}

public func cardHeightForBuckets(_ m: HudMetrics, _ count: Int) -> Double {
  cardHeightFor(m, buckets: Swift.max(1, count))
}

public func cardMessageHeight(_ m: HudMetrics) -> Double {
  cardHeightFor(m, buckets: 0)
}

/// The tallest card any provider can produce. The window is sized for it
/// once, so a taller-than-usual card is never clipped by its frame.
public func cardReserveHeight(_ m: HudMetrics) -> Double {
  cardHeightFor(
    m, buckets: HudLimits.maxCardBuckets,
    sessions: HudLimits.maxCardSessions + 1, tokens: true
  )
}

// MARK: - Notch

/// The display's own notch, when the dock shares the bezel with one.
public struct HardwareNotch: Sendable, Codable, Equatable {
  public var width: Double
  public var height: Double

  public init(width: Double, height: Double) {
    self.width = width
    self.height = height
  }
}

/// The notch to draw on a display without one: a MacBook's width, and exactly
/// the menu bar's height so the resting tab sits inside the bar. It is the
/// dock's own, so it scales with it.
public func virtualNotch(_ m: HudMetrics, menuBarHeight: Double)
  -> HardwareNotch
{
  HardwareNotch(
    width: m.notchWidth,
    height: menuBarHeight > 0 ? jsRound(menuBarHeight) : m.notchDepth
  )
}

/// How long a compact rail has to be when it is drawn as the display's notch:
/// never narrower than the hardware plus a corner each side, or it reads as a
/// straight column that never opened.
public func joinedNotchRailLength(
  _ m: HudMetrics, _ count: Int, notch: HardwareNotch
) -> Double {
  Swift.max(
    railLengthForCount(m, count, compact: true),
    notch.width + 2 * m.notchRadius
  )
}

/// Extra length at each end of a rail stretched past what its meters need,
/// so the meters — and the tails aimed at them — stay centred.
public func railEndSpread(
  _ m: HudMetrics, _ count: Int, compact: Bool, railLength: Double
) -> Double {
  Swift.max(0, (railLength - railLengthForCount(m, count, compact: compact)) / 2)
}
