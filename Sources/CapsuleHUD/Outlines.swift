import CapsuleCore
import Foundation

/// Corner radius the style wants on the rail, held to the rail's own size.
private func railCornerRadius(
  _ m: HudMetrics, _ style: DockStyle, _ rail: Rect, notch: Bool
) -> Double {
  let base: Double
  switch style.radius {
  case .pill: base = rail.width / 2
  case .scale(let factor): base = (notch ? m.notchRadius : m.railRadius) * factor
  }
  return min(base, rail.width / 2, rail.height / 2)
}

/// The rail. In the default style it is rounded on the inner side and blended
/// into the screen edge by a concave fillet at each end; as a notch the
/// fillets stay — they make it read as carved out of the screen — but the
/// corners tighten to match the menu bar. Floating styles drop the fillets.
public func railPath(
  _ m: HudMetrics, _ growth: CardGrowth, _ layout: BlobLayout,
  notch: Bool = false, style: DockStyle = .rail, rail: Rect? = nil,
  flare: Double? = nil
) -> [PathCommand] {
  let base = layout.canonical
  return traceRail(
    m, mapperFor(growth, canonicalWidth: base.width), rail ?? base.rail,
    notch: notch, style: style, flare: flare
  )
}

/// The rail traced through `mapper`, for whatever rect it occupies — the full
/// rail, the resting latch, or anything the fold passes through.
public func traceRail(
  _ m: HudMetrics, _ mapper: Mapper, _ rail: Rect,
  notch: Bool = false, style: DockStyle = .rail, flare wanted: Double? = nil
) -> [PathCommand] {
  let wantedFlare = wanted ?? m.edgeFlare * style.flare
  // Order matters. The corner is claimed first, out of half the width, and the
  // flare takes what is left across; then the corner gives way to the flare
  // along the length. Letting the flare take the full width collapses a thin
  // shape into a self-crossing outline — and thin is exactly what the rail is
  // while it folds out of its latch.
  let corner = railCornerRadius(m, style, rail, notch: notch)
  let flare = max(0, min(wantedFlare, rail.height / 2, rail.width - corner))
  let radius = max(0, min(corner, (rail.height - 2 * flare) / 2))

  if flare <= 0 {
    return roundedRect(mapper, rail, radius: radius)
  }

  let outer = rail.x + rail.width
  let inner = rail.x
  let top = rail.y
  let bottom = rail.y + rail.height

  var path = PathBuilder(mapper)
  path.move(outer, top - flare)
  path.arc(flare, sweep: 1, outer - flare, top)
  path.line(inner + radius, top)
  path.arc(radius, sweep: 0, inner, top + radius)
  path.line(inner, bottom - radius)
  path.arc(radius, sweep: 0, inner + radius, bottom)
  path.line(outer - flare, bottom)
  path.arc(flare, sweep: 1, outer, bottom + flare)
  path.close()
  return path.commands
}

/// The card and its tail as one speech bubble. The tail runs all the way onto
/// the rail — and a hair past it, so antialiasing cannot leave a seam —
/// because any daylight between the two lets the desktop show through.
public func bubblePath(_ m: HudMetrics, _ growth: CardGrowth, _ layout: BlobLayout)
  -> [PathCommand]
{
  let base = layout.canonical
  let card = base.card
  let radius = min(m.cardRadius, card.width / 2, card.height / 2)
  let edge = card.x + card.width
  let half = min(m.tailBase / 2, max(0, card.height / 2 - radius))
  let length = base.tipX - edge + max(1, m.unit)
  let cy = clamp(
    base.joinY, card.y + radius + half, card.y + card.height - radius - half
  )
  let top = card.y
  let bottom = card.y + card.height

  var path = PathBuilder(mapperFor(growth, canonicalWidth: base.width))
  path.move(card.x + radius, top)
  path.line(edge - radius, top)
  path.arc(radius, sweep: 1, edge, top + radius)
  path.line(edge, cy - half)
  path.curve(
    edge, cy - half * 0.6, edge + length * 0.49, cy - 2, edge + length, cy
  )
  path.curve(
    edge + length * 0.49, cy + 2, edge, cy + half * 0.6, edge, cy + half
  )
  path.line(edge, bottom - radius)
  path.arc(radius, sweep: 1, edge - radius, bottom)
  path.line(card.x + radius, bottom)
  path.arc(radius, sweep: 1, card.x, bottom - radius)
  path.line(card.x, top + radius)
  path.arc(radius, sweep: 1, card.x + radius, top)
  path.close()
  return path.commands
}
