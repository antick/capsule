import CapsuleCore
import CoreGraphics
import Foundation

/// An outline as a `CGPath`, for a `CAShapeLayer` to draw and hit-test.
///
/// The commands are in the dock's own frame, y growing downward as in the
/// original's SVG. Draw them in a flipped view or layer; the arcs are placed
/// by angle, so they bend the right way in either convention.
public func cgPath(_ commands: [PathCommand]) -> CGPath {
  let path = CGMutablePath()
  var current = CGPoint.zero
  var start = CGPoint.zero
  for command in commands {
    switch command {
    case .move(let to):
      current = CGPoint(x: to.x, y: to.y)
      start = current
      path.move(to: current)
    case .line(let to):
      current = CGPoint(x: to.x, y: to.y)
      path.addLine(to: current)
    case .curve(let c1, let c2, let to):
      current = CGPoint(x: to.x, y: to.y)
      path.addCurve(
        to: current, control1: CGPoint(x: c1.x, y: c1.y),
        control2: CGPoint(x: c2.x, y: c2.y)
      )
    case .arc(let radius, let sweep, let to):
      let end = CGPoint(x: to.x, y: to.y)
      addArc(path, from: current, to: end, radius: radius, sweep: sweep)
      current = end
    case .close:
      path.closeSubpath()
      current = start
    }
  }
  return path
}

/// An SVG elliptical arc reduced to the case the dock uses — circular, no
/// rotation, the small arc — converted from end points to centre and angles
/// (SVG 1.1, appendix F.6.5).
///
/// `sweep` 1 means the angle increases from start to end, which in CoreGraphics
/// terms is `clockwise: false`: that flag names a decreasing angle, whatever
/// the coordinate system looks like on screen.
private func addArc(
  _ path: CGMutablePath, from p0: CGPoint, to p1: CGPoint, radius: Double,
  sweep: Int
) {
  guard radius > 0, p0 != p1 else {
    path.addLine(to: p1)
    return
  }
  let x1 = (p0.x - p1.x) / 2
  let y1 = (p0.y - p1.y) / 2
  var r = radius
  // A radius too small to span the chord is scaled up, as SVG requires.
  let lambda = (x1 * x1 + y1 * y1) / (r * r)
  if lambda > 1 { r *= lambda.squareRoot() }

  let numerator = max(0, r * r * r * r - r * r * y1 * y1 - r * r * x1 * x1)
  let denominator = r * r * y1 * y1 + r * r * x1 * x1
  // Small arc, so the centre sits on the side the sweep direction implies.
  let sign: Double = sweep == 1 ? 1 : -1
  let coefficient = sign * (numerator / denominator).squareRoot()
  let cx1 = coefficient * y1
  let cy1 = -coefficient * x1
  let centre = CGPoint(x: cx1 + (p0.x + p1.x) / 2, y: cy1 + (p0.y + p1.y) / 2)

  let startAngle = atan2((y1 - cy1) / r, (x1 - cx1) / r)
  let endAngle = atan2((-y1 - cy1) / r, (-x1 - cx1) / r)
  path.addArc(
    center: centre, radius: r, startAngle: startAngle, endAngle: endAngle,
    clockwise: sweep != 1
  )
}
