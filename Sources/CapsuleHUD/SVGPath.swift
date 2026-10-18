import CoreGraphics
import Foundation

/// SVG path data as a `CGPath`: every command the provider marks use, in
/// absolute and relative forms, with implicit repeats and packed arc flags
/// (`a7 7 0 00-1 1`). Coordinates are kept as SVG writes them, y down.
public func svgPath(_ data: String) -> CGPath {
  var scanner = PathScanner(Array(data.utf8))
  let path = CGMutablePath()
  var current = CGPoint.zero
  var start = CGPoint.zero
  var lastControl: CGPoint?
  var lastQuad: CGPoint?
  var command: UInt8 = 0

  while true {
    scanner.skipSeparators()
    guard let next = scanner.peek else { break }
    if isCommand(next) {
      command = next
      scanner.advance()
    } else if command == 0 {
      break
    }
    let relative = command >= UInt8(ascii: "a")
    let base = relative ? current : .zero
    func point() -> CGPoint? {
      guard let x = scanner.number(), let y = scanner.number() else { return nil }
      return CGPoint(x: base.x + x, y: base.y + y)
    }
    var control: CGPoint?
    var quad: CGPoint?
    switch command | 0x20 {
    case UInt8(ascii: "m"):
      guard let to = point() else { return path }
      path.move(to: to)
      current = to
      start = to
      // Further pairs after a move are lines.
      command = relative ? UInt8(ascii: "l") : UInt8(ascii: "L")
    case UInt8(ascii: "l"):
      guard let to = point() else { return path }
      path.addLine(to: to)
      current = to
    case UInt8(ascii: "h"):
      guard let x = scanner.number() else { return path }
      current = CGPoint(x: (relative ? current.x : 0) + x, y: current.y)
      path.addLine(to: current)
    case UInt8(ascii: "v"):
      guard let y = scanner.number() else { return path }
      current = CGPoint(x: current.x, y: (relative ? current.y : 0) + y)
      path.addLine(to: current)
    case UInt8(ascii: "c"):
      guard let c1 = point(), let c2 = point(), let to = point() else { return path }
      path.addCurve(to: to, control1: c1, control2: c2)
      control = c2
      current = to
    case UInt8(ascii: "s"):
      guard let c2 = point(), let to = point() else { return path }
      let c1 = lastControl.map { reflect($0, about: current) } ?? current
      path.addCurve(to: to, control1: c1, control2: c2)
      control = c2
      current = to
    case UInt8(ascii: "q"):
      guard let c = point(), let to = point() else { return path }
      path.addQuadCurve(to: to, control: c)
      quad = c
      current = to
    case UInt8(ascii: "t"):
      guard let to = point() else { return path }
      let c = lastQuad.map { reflect($0, about: current) } ?? current
      path.addQuadCurve(to: to, control: c)
      quad = c
      current = to
    case UInt8(ascii: "a"):
      guard let rx = scanner.number(), let ry = scanner.number(), let rotation = scanner.number(),
        let large = scanner.flag(), let sweep = scanner.flag(), let to = point()
      else { return path }
      addArc(path, from: current, to: to, rx: rx, ry: ry, rotation: rotation, large: large, sweep: sweep)
      current = to
    case UInt8(ascii: "z"):
      path.closeSubpath()
      current = start
    default:
      return path
    }
    lastControl = control
    lastQuad = quad
  }
  return path
}

private func isCommand(_ byte: UInt8) -> Bool {
  "MmLlHhVvCcSsQqTtAaZz".utf8.contains(byte)
}

private func reflect(_ point: CGPoint, about center: CGPoint) -> CGPoint {
  CGPoint(x: 2 * center.x - point.x, y: 2 * center.y - point.y)
}

/// The SVG endpoint arc, converted to its centre form and drawn as cubic
/// Béziers of at most a quarter turn each.
private func addArc(
  _ path: CGMutablePath, from p0: CGPoint, to p1: CGPoint, rx rx0: Double, ry ry0: Double,
  rotation: Double, large: Bool, sweep: Bool
) {
  var rx = abs(rx0)
  var ry = abs(ry0)
  guard rx > 0, ry > 0, p0 != p1 else {
    path.addLine(to: p1)
    return
  }
  let phi = rotation * .pi / 180
  let cosPhi = cos(phi)
  let sinPhi = sin(phi)
  let dx = (p0.x - p1.x) / 2
  let dy = (p0.y - p1.y) / 2
  let x1 = cosPhi * dx + sinPhi * dy
  let y1 = -sinPhi * dx + cosPhi * dy
  // Radii too small to reach are scaled up until they just do.
  let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if lambda > 1 {
    rx *= lambda.squareRoot()
    ry *= lambda.squareRoot()
  }
  let numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
  var factor = (max(0, numerator) / denominator).squareRoot()
  if large == sweep { factor = -factor }
  let cx1 = factor * rx * y1 / ry
  let cy1 = -factor * ry * x1 / rx
  let cx = cosPhi * cx1 - sinPhi * cy1 + (p0.x + p1.x) / 2
  let cy = sinPhi * cx1 + cosPhi * cy1 + (p0.y + p1.y) / 2

  func angle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double {
    let value = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return value
  }
  let theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
  var delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
  if !sweep, delta > 0 { delta -= 2 * .pi }
  if sweep, delta < 0 { delta += 2 * .pi }

  let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
  let step = delta / Double(segments)
  let k = 4.0 / 3.0 * tan(step / 4)
  func point(_ t: Double) -> (CGPoint, CGPoint) {
    let x = rx * cos(t)
    let y = ry * sin(t)
    let dxdt = -rx * sin(t)
    let dydt = ry * cos(t)
    let p = CGPoint(x: cx + cosPhi * x - sinPhi * y, y: cy + sinPhi * x + cosPhi * y)
    let d = CGPoint(x: cosPhi * dxdt - sinPhi * dydt, y: sinPhi * dxdt + cosPhi * dydt)
    return (p, d)
  }
  var t = theta1
  for _ in 0..<segments {
    let (a, da) = point(t)
    let (b, db) = point(t + step)
    path.addCurve(
      to: b,
      control1: CGPoint(x: a.x + k * da.x, y: a.y + k * da.y),
      control2: CGPoint(x: b.x - k * db.x, y: b.y - k * db.y)
    )
    t += step
  }
}

/// Reads numbers and arc flags out of path data the way SVG's grammar does:
/// a sign or a second decimal point starts the next number.
private struct PathScanner {
  private let bytes: [UInt8]
  private var index = 0

  init(_ bytes: [UInt8]) { self.bytes = bytes }

  var peek: UInt8? { index < bytes.count ? bytes[index] : nil }
  mutating func advance() { index += 1 }

  mutating func skipSeparators() {
    while let byte = peek, byte == 0x20 || byte == 0x2C || byte == 0x0A || byte == 0x0D || byte == 0x09 {
      index += 1
    }
  }

  mutating func flag() -> Bool? {
    skipSeparators()
    guard let byte = peek, byte == UInt8(ascii: "0") || byte == UInt8(ascii: "1") else { return nil }
    index += 1
    return byte == UInt8(ascii: "1")
  }

  mutating func number() -> Double? {
    skipSeparators()
    let begin = index
    if let byte = peek, byte == UInt8(ascii: "-") || byte == UInt8(ascii: "+") { index += 1 }
    var seenDot = false
    var seenDigit = false
    var seenExponent = false
    while let byte = peek {
      if byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9") {
        seenDigit = true
        index += 1
      } else if byte == UInt8(ascii: "."), !seenDot, !seenExponent {
        seenDot = true
        index += 1
      } else if (byte == UInt8(ascii: "e") || byte == UInt8(ascii: "E")), seenDigit, !seenExponent {
        seenExponent = true
        index += 1
        if let sign = peek, sign == UInt8(ascii: "-") || sign == UInt8(ascii: "+") { index += 1 }
      } else {
        break
      }
    }
    guard seenDigit else {
      index = begin
      return nil
    }
    return Double(String(decoding: bytes[begin..<index], as: UTF8.self))
  }
}
