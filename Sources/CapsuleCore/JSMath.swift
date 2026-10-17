import Foundation

/// JavaScript's `Math.round`: the nearest integer, with halves going toward
/// +∞. Swift's `.rounded()` sends halves away from zero instead, so the two
/// disagree on every negative half — `Math.round(-2.5)` is `-2`, Swift's is
/// `-3`. Every port of a `Math.round` call goes through this.
///
/// Written as floor-plus-remainder rather than `floor(x + 0.5)`, which gets
/// `0.49999999999999994` wrong: adding the half rounds up in binary first.
public func jsRound(_ value: Double) -> Double {
  guard value.isFinite else { return value }
  let floor = value.rounded(.down)
  return value - floor >= 0.5 ? floor + 1 : floor
}

/// `Number(value.toFixed(2))` for the values the dock actually feeds it.
///
/// `toFixed` rounds the exact binary value and breaks exact ties toward the
/// larger number, where C's `%.2f` breaks them to even. A scale step never
/// lands on an exact tie in the third decimal, so rounding the hundredths the
/// way `Math.round` does gives the same answer; `hud-metrics/clamp-scale`
/// checks that it keeps doing so.
public func jsFixed2(_ value: Double) -> Double {
  jsRound(value * 100) / 100
}
