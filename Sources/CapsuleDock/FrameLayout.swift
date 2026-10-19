import CapsuleCore
import CapsuleHUD
import CoreGraphics
import Foundation

/// The parts of the dock's shape that only change when settings or the
/// placement do.
public struct FrameSpec: Equatable, Sendable {
  public var metrics: HudMetrics
  public var style: DockStyle
  public var growth: CardGrowth
  /// Drawn as a notch at the top of the screen.
  public var notch: Bool
  /// Lying along an edge: meters drop their percent captions.
  public var compact: Bool
  public var railLength: Double
  /// Where the rail sits in its frame, from the placement engine.
  public var railBias: Double?
  /// The display's own notch, when the rail is drawn as it.
  public var joined: HardwareNotch?

  public init(
    metrics: HudMetrics, style: DockStyle, growth: CardGrowth, notch: Bool, compact: Bool,
    railLength: Double, railBias: Double?, joined: HardwareNotch?
  ) {
    self.metrics = metrics
    self.style = style
    self.growth = growth
    self.notch = notch
    self.compact = compact
    self.railLength = railLength
    self.railBias = railBias
    self.joined = joined
  }

  public var vertical: Bool { growth == .left || growth == .right }
  var flare: Double { joined != nil ? metrics.notchBezelFillet : metrics.edgeFlare * style.flare }
  var railDepth: Double { metrics.railWidth + (joined?.height ?? 0) }
}

/// The animated values a frame is drawn at.
public struct FrameMotion: Equatable, Sendable {
  /// 0 is the resting latch, 1 the open rail.
  public var openness: Double
  /// Where along the rail the card's tail aims.
  public var joinOffset: Double
  /// The card's length along the rail.
  public var cardAlong: Double

  public init(openness: Double, joinOffset: Double, cardAlong: Double) {
    self.openness = openness
    self.joinOffset = joinOffset
    self.cardAlong = cardAlong
  }
}

/// Everything one frame of the dock draws, in the dock view's coordinates:
/// top-left origin, y down, shadow gutter included.
public struct FrameLayout {
  public let size: CGSize
  public let padding: FramePadding
  public let blob: BlobLayout
  /// The rail at this point of its fold.
  public let rail: CGPath
  /// The same outline in the full rail's own box, to clip the meters with.
  public let railClip: CGPath
  /// The full, unfolded rail's box.
  public let railBox: CGRect
  public let bubble: CGPath
  public let card: CGRect
  /// Where the tail meets the rail: the point the card grows from.
  public let tip: CGPoint
  /// The resting tab.
  public let latch: CGRect
  /// Room inside the rail around the meters.
  public let railInsets: (top: Double, left: Double, bottom: Double, right: Double)
}

public func frameLayout(_ spec: FrameSpec, _ motion: FrameMotion) -> FrameLayout {
  let m = spec.metrics
  let blob = blobLayout(
    m,
    BlobLayoutInput(
      cardGrowth: spec.growth, railLength: spec.railLength, joinOffset: motion.joinOffset,
      cardHeight: motion.cardAlong, cardReserve: cardReserveHeight(m), style: spec.style,
      railBias: spec.railBias, railDepth: spec.railDepth, flare: spec.flare
    )
  )
  let pad = framePadding(m, spec.growth, style: spec.style)
  let morph = railMorph(
    m, spec.growth, blob, openness: motion.openness, notch: spec.notch, style: spec.style,
    flare: spec.flare, resting: restingRail(m, blob, joined: spec.joined)
  )
  var shift = CGAffineTransform(translationX: pad.left, y: pad.top)
  func placed(_ commands: [PathCommand]) -> CGPath {
    let path = cgPath(commands)
    return path.copy(using: &shift) ?? path
  }
  func box(_ rect: Rect) -> CGRect {
    CGRect(x: rect.x + pad.left, y: rect.y + pad.top, width: rect.width, height: rect.height)
  }
  let along = spec.compact ? m.notchPaddingY : m.railPaddingY
  let across = m.railPaddingX
  let edge = across + (spec.joined?.height ?? 0)
  let insets: (Double, Double, Double, Double)
  switch spec.growth {
  case .left: insets = (along, across, along, edge)
  case .right: insets = (along, edge, along, across)
  case .up: insets = (across, along, edge, along)
  case .down: insets = (edge, along, across, along)
  }
  return FrameLayout(
    size: CGSize(width: blob.width + pad.left + pad.right, height: blob.height + pad.top + pad.bottom),
    padding: pad,
    blob: blob,
    rail: placed(morph.path),
    railClip: cgPath(morph.clip),
    railBox: box(blob.rail),
    bubble: placed(bubblePath(m, spec.growth, blob)),
    card: box(blob.card),
    tip: CGPoint(x: blob.tip.x + pad.left, y: blob.tip.y + pad.top),
    latch: box(latchRect(m, spec.growth, blob, joined: spec.joined)),
    railInsets: insets
  )
}

/// The card's height for what it has to show. Notices replace the readings
/// while they are up. A port of `dockCardHeight`.
public func dockCardHeight(
  _ m: HudMetrics, snapshot: UsageSnapshot?, sessions: Int, notices: Int, tokens: Bool
) -> Double {
  if notices > 0 {
    let shown = min(notices, NoticePresentation.maxVisible)
    let more = notices > NoticePresentation.maxVisible ? m.cardSectionGap + m.cardTextLine : 0
    return cardHeightFor(m, buckets: 0, sessions: shown) + more
  }
  let status = snapshot?.status
  // Extras are drawn in a window's shape, so each counts as one more row;
  // one with no share to show has no bar.
  let extras = snapshot?.extras ?? []
  let rows = (snapshot?.buckets.count ?? 0) + extras.count
  let shown = status == .unauthenticated || status == .disabled ? 0 : rows
  let barless = shown == 0 ? 0 : extras.filter { $0.percentUsed == nil }.count
  return cardHeightFor(m, buckets: shown, sessions: sessions, tokens: tokens)
    - Double(barless) * (m.barHeight + m.cardBucketGap)
}
