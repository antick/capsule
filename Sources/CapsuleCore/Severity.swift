import Foundation

/// Which band a usage percent falls in. Ported from `@capsule/config`.
public enum Severity: String, Sendable, CaseIterable, Codable {
  case low, mid, high, critical
}

/// Upper bound of each band, inclusive. The only place these numbers live.
public enum SeverityBands {
  public static let low = 39.0
  public static let mid = 69.0
  public static let high = 89.0
  public static let critical = 100.0
}

public func severityForPercent(_ percent: Double) -> Severity {
  if percent <= SeverityBands.low { return .low }
  if percent <= SeverityBands.mid { return .mid }
  if percent <= SeverityBands.high { return .high }
  return .critical
}
