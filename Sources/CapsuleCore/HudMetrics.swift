import Foundation

// The field list and authored sizes were copied mechanically from
// `SCALED_KEYS` and `HUD_BASE` in packages/config. While both exist, change
// them together: `hud-metrics/metrics` in the fixture corpus fails this suite
// the moment the two disagree.

/// Every pixel size the dock draws with at one scale. Authored once at scale
/// 1 — the size it ships at — so the whole HUD grows and shrinks as a unit.
public struct HudMetrics: Sendable, Codable, Equatable {
  /// The user's size preference, where 1 is 100%.
  public var scale: Double = 1
  /// The same number, named for what it does: the multiplier on every
  /// authored dimension.
  public var unit: Double = 1
  public var railWidth: Double = 0
  public var railPaddingX: Double = 0
  public var railPaddingY: Double = 0
  public var railRadius: Double = 0
  public var edgeFlare: Double = 0
  public var meterSize: Double = 0
  public var ringStroke: Double = 0
  public var iconSize: Double = 0
  public var meterLabelGap: Double = 0
  public var percentBlock: Double = 0
  public var percentFontSize: Double = 0
  public var itemGap: Double = 0
  public var cardWidth: Double = 0
  public var cardRadius: Double = 0
  public var cardPaddingX: Double = 0
  public var cardPaddingTop: Double = 0
  public var cardPaddingBottom: Double = 0
  public var cardTitleSize: Double = 0
  public var cardTitleLine: Double = 0
  public var cardTitleGap: Double = 0
  public var cardIconSize: Double = 0
  public var cardIconGap: Double = 0
  public var cardLabelSize: Double = 0
  public var cardResetSize: Double = 0
  public var cardResetGap: Double = 0
  public var cardTextLine: Double = 0
  public var cardBucketGap: Double = 0
  public var cardSectionGap: Double = 0
  public var barHeight: Double = 0
  public var tailBase: Double = 0
  public var tailLength: Double = 0
  public var joinGap: Double = 0
  public var shadowPadding: Double = 0
  public var notchRadius: Double = 0
  public var notchPaddingY: Double = 0
  public var notchWidth: Double = 0
  public var notchDepth: Double = 0
  public var beaconSize: Double = 0
  public var latchThickness: Double = 0
  public var latchLength: Double = 0
  public var latchReach: Double = 0
  public var stowShift: Double = 0
  public var activitySize: Double = 0
  public var activityStroke: Double = 0
  public var cardRule: Double = 0
  public var cardRuleGap: Double = 0
  public var cardStatusDot: Double = 0
  public var cardStatusStroke: Double = 0
  public var cardStatusGap: Double = 0
  public var notchBezelFillet: Double = 0

  public init() {}
}

extension HudMetrics {
  /// Each scaled dimension and its size at scale 1. The only place these
  /// numbers live.
  static let authored: [(WritableKeyPath<HudMetrics, Double> & Sendable, Double)] = [
    (\.railWidth, 58),
    (\.railPaddingX, 8),
    (\.railPaddingY, 12),
    (\.railRadius, 29),
    (\.edgeFlare, 26),
    (\.meterSize, 38),
    (\.ringStroke, 4),
    (\.iconSize, 16),
    (\.meterLabelGap, 4),
    (\.percentBlock, 12),
    (\.percentFontSize, 11),
    (\.itemGap, 12),
    (\.cardWidth, 232),
    (\.cardRadius, 16),
    (\.cardPaddingX, 14),
    (\.cardPaddingTop, 12),
    (\.cardPaddingBottom, 13),
    (\.cardTitleSize, 14),
    (\.cardTitleLine, 18),
    (\.cardTitleGap, 11),
    (\.cardIconSize, 18),
    (\.cardIconGap, 8),
    (\.cardLabelSize, 11),
    (\.cardResetSize, 11),
    (\.cardResetGap, 10),
    (\.cardTextLine, 15),
    (\.cardBucketGap, 5),
    (\.cardSectionGap, 10),
    (\.barHeight, 6),
    (\.tailBase, 30),
    (\.tailLength, 16),
    (\.joinGap, 6),
    (\.shadowPadding, 18),
    (\.notchRadius, 16),
    (\.notchPaddingY, 8),
    (\.notchWidth, 200),
    (\.notchDepth, 32),
    (\.beaconSize, 4),
    (\.latchThickness, 5),
    (\.latchLength, 64),
    (\.latchReach, 18),
    (\.stowShift, 10),
    (\.activitySize, 23),
    (\.activityStroke, 2),
    (\.cardRule, 1),
    (\.cardRuleGap, 10),
    (\.cardStatusDot, 8),
    (\.cardStatusStroke, 1.5),
    (\.cardStatusGap, 5),
    (\.notchBezelFillet, 8),
  ]
}
