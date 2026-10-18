import CapsuleCore
import Foundation

/// A CSS `cubic-bezier()` timing curve.
public struct Easing: Sendable, Equatable {
  let x1: Double
  let y1: Double
  let x2: Double
  let y2: Double

  public init(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) {
    (self.x1, self.y1, self.x2, self.y2) = (x1, y1, x2, y2)
  }

  /// Things arriving: fast, then settling.
  public static let out = Easing(0.22, 1, 0.36, 1)
  /// Things being absorbed accelerate as they go.
  public static let close = Easing(0.4, 0, 0.9, 0.6)

  /// Progress along the curve at time fraction `t`.
  public func value(_ t: Double) -> Double {
    let t = min(1, max(0, t))
    // Solve x(s) = t by Newton's method, falling back to bisection.
    var s = t
    for _ in 0..<8 {
      let x = bezier(s, x1, x2) - t
      let slope = derivative(s, x1, x2)
      if abs(x) < 1e-6 { return bezier(s, y1, y2) }
      if abs(slope) < 1e-6 { break }
      s -= x / slope
    }
    var low = 0.0
    var high = 1.0
    s = t
    for _ in 0..<30 {
      let x = bezier(s, x1, x2)
      if abs(x - t) < 1e-6 { break }
      if x < t { low = s } else { high = s }
      s = (low + high) / 2
    }
    return bezier(s, y1, y2)
  }

  private func bezier(_ s: Double, _ a: Double, _ b: Double) -> Double {
    let inv = 1 - s
    return 3 * inv * inv * s * a + 3 * inv * s * s * b + s * s * s
  }

  private func derivative(_ s: Double, _ a: Double, _ b: Double) -> Double {
    let inv = 1 - s
    return 3 * inv * inv * a + 6 * inv * s * (b - a) + 3 * s * s * (1 - b)
  }
}

/// A value easing from one number to another over a fixed time.
public struct Tween: Sendable, Equatable {
  public private(set) var from: Double
  public private(set) var to: Double
  private var startMs: Double
  private var durationMs: Double
  private var easing: Easing

  public init(value: Double) {
    from = value
    to = value
    startMs = 0
    durationMs = 0
    easing = .out
  }

  public func value(at nowMs: Double) -> Double {
    guard durationMs > 0 else { return to }
    let t = (nowMs - startMs) / durationMs
    return t >= 1 ? to : from + (to - from) * easing.value(t)
  }

  public func done(at nowMs: Double) -> Bool { durationMs <= 0 || nowMs - startMs >= durationMs }

  /// Heads for `target` from wherever it is now.
  public mutating func retarget(_ target: Double, at nowMs: Double, durationMs ms: Double, easing curve: Easing) {
    guard target != to else { return }
    from = value(at: nowMs)
    to = target
    startMs = nowMs
    durationMs = ms
    easing = curve
  }
}
