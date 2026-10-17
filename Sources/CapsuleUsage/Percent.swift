import Foundation

/// Holds a percent inside 0–100. A value that is not a number at all is 0,
/// not a crash and not a guess.
public func clampPercent(_ value: Double) -> Double {
  guard value.isFinite else { return 0 }
  if value < 0 { return 0 }
  if value > 100 { return 100 }
  return value
}

/// Reads a provider's utilization whether it arrives as a fraction or a
/// percent. A bare `1` is one percent, not a full fraction: treating it as
/// 100% would show a nearly-unused provider as exhausted.
public func toPercent(_ value: Double?) -> Double {
  guard let value, value.isFinite else { return 0 }
  if value > 0 && value < 1 { return clampPercent(value * 100) }
  return clampPercent(value)
}
