import CapsuleCore
import Foundation

/// The tab the dock folds down to, in the canonical frame: a sliver on the
/// rail's outer face, centred along it, so opening and closing share a centre
/// line and the dock never slides along the edge as it grows.
///
/// Joined to a display's notch it folds away to exactly that notch, so
/// nothing shows at rest and reaching for it makes the notch itself grow.
public func restingRail(
  _ m: HudMetrics, _ layout: BlobLayout, joined: HardwareNotch? = nil
) -> Rect {
  let rail = layout.canonical.rail
  let across = joined?.height ?? m.latchThickness
  let along = min(joined?.width ?? m.latchLength, rail.height)
  return Rect(
    x: rail.x + rail.width - across,
    y: rail.y + (rail.height - along) / 2,
    width: across,
    height: along
  )
}

/// The same tab, where it lands in the oriented frame.
public func latchRect(
  _ m: HudMetrics, _ growth: CardGrowth, _ layout: BlobLayout,
  joined: HardwareNotch? = nil
) -> Rect {
  mapRect(
    restingRail(m, layout, joined: joined), growth: growth,
    canonicalWidth: layout.canonical.width
  )
}

/// The band a retracted dock answers to: the latch plus a reach inward from
/// it. The tab is too thin to aim at, so the dock wakes for anywhere along its
/// own length within easy reach of the edge.
public func latchHotZone(
  _ m: HudMetrics, _ growth: CardGrowth, _ layout: BlobLayout,
  joined: HardwareNotch? = nil
) -> Rect {
  var zone = latchRect(m, growth, layout, joined: joined)
  let reach = m.latchReach
  switch growth {
  case .left:
    zone.x -= reach
    zone.width += reach
  case .right:
    zone.width += reach
  case .up:
    zone.y -= reach
    zone.height += reach
  case .down:
    zone.height += reach
  }
  return zone
}

public func lerpRect(_ a: Rect, _ b: Rect, _ t: Double) -> Rect {
  func lerp(_ a: Double, _ b: Double) -> Double { a + (b - a) * t }
  return Rect(
    x: lerp(a.x, b.x), y: lerp(a.y, b.y),
    width: lerp(a.width, b.width), height: lerp(a.height, b.height)
  )
}

public struct RailMorph: Sendable, Equatable {
  /// The rail's rect at this point of the fold, in the canonical frame.
  public var rail: Rect
  /// Its outline, in frame coordinates.
  public var path: [PathCommand]
  /// The same outline in the rail box's own coordinates, for clipping.
  public var clip: [PathCommand]
}

/// The rail part-way between its resting tab and its full length: `openness`
/// 0 is the latch, 1 the open rail, and anything outside is clamped.
///
/// One shape grows out of the edge, rather than a tab fading while a rail
/// slides in behind it, so the dock never reads as two objects swapping. The
/// meters are clipped by this same outline, so they are swallowed by the
/// shape as it closes instead of sliding out of the end of it.
public func railMorph(
  _ m: HudMetrics, _ growth: CardGrowth, _ layout: BlobLayout,
  openness: Double, notch: Bool = false, style: DockStyle = .rail,
  flare: Double? = nil, resting: Rect? = nil
) -> RailMorph {
  let base = layout.canonical
  let k = min(1, max(0, openness))
  let rest = resting ?? restingRail(m, layout)
  let rail = k >= 1 ? base.rail : k <= 0 ? rest : lerpRect(rest, base.rail, k)
  let mapper = mapperFor(growth, canonicalWidth: base.width)
  let local = Mapper(
    growth: growth, canonicalWidth: base.width,
    offset: PathPoint(x: layout.rail.x, y: layout.rail.y)
  )
  return RailMorph(
    rail: rail,
    path: traceRail(m, mapper, rail, notch: notch, style: style, flare: flare),
    clip: traceRail(m, local, rail, notch: notch, style: style, flare: flare)
  )
}

/// Which way, and how far, a meter slides toward the screen edge as the dock
/// folds. A short slide and no scaling: the outline already conceals, and
/// scaling on top of it reads as two effects fighting.
public func stowShift(_ m: HudMetrics, _ growth: CardGrowth) -> PathPoint {
  let d = m.stowShift
  switch growth {
  case .left: return PathPoint(x: d, y: 0)
  case .right: return PathPoint(x: -d, y: 0)
  case .up: return PathPoint(x: 0, y: d)
  case .down: return PathPoint(x: 0, y: -d)
  }
}
