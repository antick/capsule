import CapsuleCore
import Foundation

/// The unmapped frame the silhouettes are traced in: rail flush right, card
/// to its left.
public struct CanonicalFrame: Sendable, Codable, Equatable {
  public var width: Double
  public var height: Double
  public var rail: Rect
  public var card: Rect
  public var joinY: Double
  public var tipX: Double
}

public struct BlobLayout: Sendable, Codable, Equatable {
  public var width: Double
  public var height: Double
  /// Rail body, excluding the concave flares that reach the screen edge.
  public var rail: Rect
  public var card: Rect
  /// Point on the rail's inner edge that the tail aims at.
  public var join: PathPoint
  /// Tail tip, the point the bubble scales out of when it opens.
  public var tip: PathPoint
  public var canonical: CanonicalFrame
}

/// What the layout needs to know about a dock.
public struct BlobLayoutInput: Sendable {
  public var cardGrowth: CardGrowth
  public var railLength: Double
  public var joinOffset: Double
  public var cardHeight: Double?
  /// Tallest card the window was sized for; defaults to the card shown.
  public var cardReserve: Double?
  public var style: DockStyle?
  /// Rail offset inside the frame; centred when nil.
  public var railBias: Double?
  /// The rail's depth across, when it is not the metrics' own: a bar drawn as
  /// the display's notch is deeper by the notch's height.
  public var railDepth: Double?
  /// The concave fillet into the edge, when it is not the style's own.
  public var flare: Double?

  public init(
    cardGrowth: CardGrowth, railLength: Double, joinOffset: Double,
    cardHeight: Double? = nil, cardReserve: Double? = nil,
    style: DockStyle? = nil, railBias: Double? = nil,
    railDepth: Double? = nil, flare: Double? = nil
  ) {
    self.cardGrowth = cardGrowth
    self.railLength = railLength
    self.joinOffset = joinOffset
    self.cardHeight = cardHeight
    self.cardReserve = cardReserve
    self.style = style
    self.railBias = railBias
    self.railDepth = railDepth
    self.flare = flare
  }
}

func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
  min(high, max(low, value))
}

func isVertical(_ growth: CardGrowth) -> Bool {
  growth == .left || growth == .right
}

/// The card is always read landscape, whichever edge the dock is on. In the
/// canonical frame the axis away from the rail is "across" and the one along
/// it is "along", so a horizontal dock swaps which side of the card takes
/// which role rather than rotating the card with the frame.
private func cardExtent(_ m: HudMetrics, _ growth: CardGrowth, _ cardHeight: Double)
  -> (across: Double, along: Double)
{
  isVertical(growth)
    ? (across: m.cardWidth, along: cardHeight)
    : (across: cardHeight, along: m.cardWidth)
}

/// Canonical geometry, traced against the reserved card extent rather than
/// the card being shown: the window is sized once for the tallest card, and
/// a narrower frame pinned to the docked edge would clip on the far side.
private func canonicalLayout(
  _ m: HudMetrics, railLength: Double, joinOffset: Double,
  card: (across: Double, along: Double),
  reserve: (across: Double, along: Double),
  flare: Double, railBias: Double?, railDepth: Double
) -> CanonicalFrame {
  let width = reserve.across + m.tailLength + m.joinGap + railDepth
  let painted = railLength + flare * 2
  let height = max(painted, reserve.along)
  let railX = reserve.across + m.tailLength + m.joinGap
  // Centred in the spare frame unless a screen edge has stopped the window,
  // in which case placement slides the rail on so it can reach the corner.
  let bias = clamp(railBias ?? (height - painted) / 2, 0, height - painted)
  let railY = bias + flare
  let joinY = railY + joinOffset
  let cardY = clamp(joinY - card.along / 2, 0, max(0, height - card.along))
  return CanonicalFrame(
    width: width,
    height: height,
    rail: Rect(x: railX, y: railY, width: railDepth, height: railLength),
    // The card keeps its own size but stays against the tail, so a short card
    // does not float away from the rail inside the reserved space.
    card: Rect(
      x: reserve.across - card.across, y: cardY,
      width: card.across, height: card.along
    ),
    joinY: joinY,
    // The tail lands on the rail rather than short of it, so the two read as
    // one surface with no desktop showing between them.
    tipX: railX
  )
}

public func blobLayout(_ m: HudMetrics, _ input: BlobLayoutInput) -> BlobLayout {
  let cardHeight = input.cardHeight ?? cardHeightForBuckets(m, 2)
  let growth = input.cardGrowth
  let style = input.style ?? .rail
  let card = cardExtent(m, growth, cardHeight)
  let reserve = cardExtent(m, growth, input.cardReserve ?? cardHeight)
  let base = canonicalLayout(
    m, railLength: input.railLength, joinOffset: input.joinOffset,
    card: card,
    reserve: (max(reserve.across, card.across), max(reserve.along, card.along)),
    flare: input.flare ?? m.edgeFlare * style.flare,
    railBias: input.railBias,
    railDepth: input.railDepth ?? m.railWidth
  )
  let vertical = isVertical(growth)
  let mapper = mapperFor(growth, canonicalWidth: base.width)
  return BlobLayout(
    width: vertical ? base.width : base.height,
    height: vertical ? base.height : base.width,
    rail: mapRect(base.rail, growth: growth, canonicalWidth: base.width),
    card: mapRect(base.card, growth: growth, canonicalWidth: base.width),
    join: mapper.point(base.rail.x, base.joinY),
    tip: mapper.point(base.tipX, base.joinY),
    canonical: base
  )
}

public struct FramePadding: Sendable, Codable, Equatable {
  public var top: Double
  public var right: Double
  public var bottom: Double
  public var left: Double
}

/// Shadow gutter around the frame. The side facing the screen edge carries
/// only the gap the dock style asks for, which is zero for the flush styles.
public func framePadding(
  _ m: HudMetrics, _ growth: CardGrowth, style: DockStyle = .rail
) -> FramePadding {
  let pad = m.shadowPadding
  let gap = dockEdgeGap(m, style)
  switch growth {
  case .left: return FramePadding(top: pad, right: gap, bottom: pad, left: pad)
  case .right: return FramePadding(top: pad, right: pad, bottom: pad, left: gap)
  case .up: return FramePadding(top: pad, right: pad, bottom: gap, left: pad)
  case .down: return FramePadding(top: gap, right: pad, bottom: pad, left: pad)
  }
}

/// Areas that should swallow the mouse, in coordinates local to the window.
public struct HitRegions: Sendable, Codable, Equatable {
  /// The rail alone, live whether or not a card is showing.
  public var rail: [Rect]
  /// Rail, tail and card as one block while the card is open. Reaching the
  /// card crosses the gap the tail spans, so that gap stays live too, or the
  /// pointer leaves the dock on the way over and the card closes itself.
  public var open: Rect?
}

/// - Parameter latchZone: set while the dock is retracted; only this band,
///   around its latch, answers the mouse.
public func hitRegions(
  _ layout: BlobLayout, padding: FramePadding, open: Bool,
  latchZone: Rect? = nil
) -> HitRegions {
  func offset(_ rect: Rect) -> Rect {
    Rect(
      x: rect.x + padding.left, y: rect.y + padding.top,
      width: rect.width, height: rect.height
    )
  }
  if let latchZone {
    return HitRegions(rail: [offset(latchZone)], open: nil)
  }
  let rail = offset(layout.rail)
  guard open else { return HitRegions(rail: [rail], open: nil) }
  let card = offset(layout.card)
  let x = min(rail.x, card.x)
  let y = min(rail.y, card.y)
  return HitRegions(
    rail: [rail],
    open: Rect(
      x: x, y: y,
      width: max(rail.x + rail.width, card.x + card.width) - x,
      height: max(rail.y + rail.height, card.y + card.height) - y
    )
  )
}
