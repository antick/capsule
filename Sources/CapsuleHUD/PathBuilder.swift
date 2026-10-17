import CapsuleCore
import Foundation

public struct PathPoint: Sendable, Codable, Equatable {
  public var x: Double
  public var y: Double

  public init(x: Double, y: Double) {
    self.x = x
    self.y = y
  }
}

/// One step of an outline. Arcs are circular, never rotated, and always the
/// small arc — the only arcs the dock's silhouettes use — so a radius and a
/// sweep direction are all an arc needs beyond its end point.
public enum PathCommand: Sendable, Equatable {
  case move(PathPoint)
  case line(PathPoint)
  case arc(radius: Double, sweep: Int, to: PathPoint)
  case curve(control1: PathPoint, control2: PathPoint, to: PathPoint)
  case close
}

/// A path coordinate, rounded to two decimals as the original's `n()` does
/// with `Math.round`. Kept apart from `jsFixed2` on purpose: that one stands
/// in for `toFixed`, and if it ever changes, path coordinates must not.
public func n(_ value: Double) -> Double {
  jsRound(value * 100) / 100
}

/// Every silhouette is authored once in a canonical frame — rail flush
/// against the right edge, meters stacked downward — then mapped into the
/// requested orientation. Mirroring transforms reverse arc sweeps.
public struct Mapper: Sendable {
  public let growth: CardGrowth
  public let canonicalWidth: Double
  /// Subtracted after mapping, to express a path in a box's own coordinates.
  public let offset: PathPoint

  public init(
    growth: CardGrowth, canonicalWidth: Double,
    offset: PathPoint = PathPoint(x: 0, y: 0)
  ) {
    self.growth = growth
    self.canonicalWidth = canonicalWidth
    self.offset = offset
  }

  public var mirrored: Bool { growth == .right || growth == .up }

  public func point(_ x: Double, _ y: Double) -> PathPoint {
    let mapped: PathPoint
    switch growth {
    case .right: mapped = PathPoint(x: canonicalWidth - x, y: y)
    case .up: mapped = PathPoint(x: y, y: x)
    case .down: mapped = PathPoint(x: y, y: canonicalWidth - x)
    case .left: mapped = PathPoint(x: x, y: y)
    }
    return PathPoint(x: mapped.x - offset.x, y: mapped.y - offset.y)
  }
}

public func mapperFor(_ growth: CardGrowth, canonicalWidth: Double) -> Mapper {
  Mapper(growth: growth, canonicalWidth: canonicalWidth)
}

/// A canonical-frame rect, as it lands in the oriented frame.
public func mapRect(_ rect: Rect, growth: CardGrowth, canonicalWidth: Double)
  -> Rect
{
  switch growth {
  case .left:
    return rect
  case .right:
    return Rect(
      x: canonicalWidth - (rect.x + rect.width), y: rect.y,
      width: rect.width, height: rect.height
    )
  case .up:
    return Rect(x: rect.y, y: rect.x, width: rect.height, height: rect.width)
  case .down:
    return Rect(
      x: rect.y, y: canonicalWidth - (rect.x + rect.width),
      width: rect.height, height: rect.width
    )
  }
}

/// Traces an outline in canonical coordinates, mapping and rounding each
/// point as it goes, exactly as the original's builder writes SVG.
public struct PathBuilder: Sendable {
  public private(set) var commands: [PathCommand] = []
  private let mapper: Mapper

  public init(_ mapper: Mapper) {
    self.mapper = mapper
  }

  private func at(_ x: Double, _ y: Double) -> PathPoint {
    let point = mapper.point(x, y)
    return PathPoint(x: n(point.x), y: n(point.y))
  }

  public mutating func move(_ x: Double, _ y: Double) {
    commands.append(.move(at(x, y)))
  }

  public mutating func line(_ x: Double, _ y: Double) {
    commands.append(.line(at(x, y)))
  }

  public mutating func arc(_ radius: Double, sweep: Int, _ x: Double, _ y: Double) {
    let flag = mapper.mirrored ? 1 - sweep : sweep
    commands.append(.arc(radius: n(radius), sweep: flag, to: at(x, y)))
  }

  public mutating func curve(
    _ c1x: Double, _ c1y: Double, _ c2x: Double, _ c2y: Double,
    _ x: Double, _ y: Double
  ) {
    commands.append(
      .curve(control1: at(c1x, c1y), control2: at(c2x, c2y), to: at(x, y))
    )
  }

  public mutating func close() {
    commands.append(.close)
  }
}

/// A plain rounded rectangle, traced clockwise in the canonical frame. The
/// radius is held to half the shorter side.
public func roundedRect(_ mapper: Mapper, _ rect: Rect, radius: Double)
  -> [PathCommand]
{
  let r = min(radius, rect.width / 2, rect.height / 2)
  let left = rect.x
  let right = rect.x + rect.width
  let top = rect.y
  let bottom = rect.y + rect.height
  var path = PathBuilder(mapper)
  path.move(left + r, top)
  path.line(right - r, top)
  path.arc(r, sweep: 1, right, top + r)
  path.line(right, bottom - r)
  path.arc(r, sweep: 1, right - r, bottom)
  path.line(left + r, bottom)
  path.arc(r, sweep: 1, left, bottom - r)
  path.line(left, top + r)
  path.arc(r, sweep: 1, left + r, top)
  path.close()
  return path.commands
}
