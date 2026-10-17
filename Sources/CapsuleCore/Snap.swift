import Foundation

/// Distance from a point to each screen edge, as a fraction of the display,
/// so a wide screen does not hand the top and bottom edges every drop. The
/// result partitions the screen into four diagonal wedges.
public func edgeAffinity(point: (x: Double, y: Double), bounds: Rect)
  -> [(edge: ScreenEdge, affinity: Double)]
{
  let width = max(1, bounds.width)
  let height = max(1, bounds.height)
  // In this order on purpose: it is the tie-break.
  return [
    (.left, (point.x - bounds.x) / width),
    (.right, (bounds.x + bounds.width - point.x) / width),
    (.top, (point.y - bounds.y) / height),
    (.bottom, (bounds.y + bounds.height - point.y) / height),
  ]
}

/// The edge a dropped dock re-docks to. Ties go to whichever comes first in
/// left, right, top, bottom — the order the original's stable sort keeps — so
/// a drop in the dead centre lands on the left, as it always has.
public func nearestEdgeForPoint(point: (x: Double, y: Double), bounds: Rect)
  -> ScreenEdge
{
  var best: (edge: ScreenEdge, affinity: Double)?
  for candidate in edgeAffinity(point: point, bounds: bounds)
  where best == nil || candidate.affinity < best!.affinity {
    best = candidate
  }
  return best?.edge ?? .right
}

public struct SlidePosition: Sendable, Codable, Equatable {
  public var x: Double
  public var y: Double
  public var railBias: Double
  public var railStart: Double
}

/// Where the dock sits while being dragged along its edge. The axis pinned to
/// the edge is fixed by the placement; only the other follows the cursor.
///
/// `grabOffset` is measured from the leading edge of the rail, not of the
/// window, so the rail stays under the cursor even where the window has to
/// stop short of the screen edge and let the rail slide on within it.
public func slideAlongEdge(
  slide: SlideTrack, anchorX: Double, anchorY: Double,
  cursor: (x: Double, y: Double), grabOffset: Double
) -> SlidePosition {
  let along = slide.axis == .x ? cursor.x : cursor.y
  let railStart = min(slide.max, max(slide.min, along - grabOffset))
  let placed = dockAlongEdge(slide, railStart: railStart)
  if slide.axis == .x {
    return SlidePosition(
      x: placed.window, y: jsRound(anchorY), railBias: placed.railBias,
      railStart: railStart
    )
  }
  return SlidePosition(
    x: jsRound(anchorX), y: placed.window, railBias: placed.railBias,
    railStart: railStart
  )
}
