import CapsuleCore
import Foundation

/// A field a provider may send as either a number or a string. Codex sends
/// `reset_at` both ways, and Grok sends credit amounts both ways.
public enum NumberOrString: Sendable, Codable, Equatable {
  case number(Double)
  case string(String)

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let value = try? container.decode(Double.self) {
      self = .number(value)
      return
    }
    self = .string(try container.decode(String.self))
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .number(let value): try container.encode(value)
    case .string(let value): try container.encode(value)
    }
  }

  /// The value as a number, for the forms that are really numeric.
  public var asDouble: Double? {
    switch self {
    case .number(let value): return value.isFinite ? value : nil
    case .string(let value): return Double(value)
    }
  }
}

/// The reset instant a provider named, as an ISO string, or `fallback` when it
/// named nothing usable.
///
/// Epoch values arrive in both seconds and milliseconds, so a value small
/// enough to be seconds is read as seconds. Getting that wrong puts the reset
/// tens of thousands of years out.
public func resetIso(_ value: NumberOrString?, fallback: Date) -> String {
  guard let value else { return isoString(fallback) }
  switch value {
  case .number(let raw):
    guard raw.isFinite else { return isoString(fallback) }
    let seconds = raw > 0 && raw < 1e12 ? raw : raw / 1000
    return isoString(Date(timeIntervalSince1970: seconds))
  case .string(let raw):
    if raw.isEmpty { return isoString(fallback) }
    if raw.allSatisfy({ $0.isNumber || $0 == "." }), Double(raw) != nil {
      return resetIso(.number(Double(raw)!), fallback: fallback)
    }
    guard let parsed = looseDate(raw) else { return isoString(fallback) }
    return isoString(parsed)
  }
}

/// The date forms providers actually send: a full ISO timestamp with or
/// without fractional seconds, and a bare `2026-09-01`, which JavaScript reads
/// as UTC midnight. Deliberately narrower than `new Date(string)`, whose
/// lenient fallbacks differ between engines.
public func looseDate(_ raw: String) -> Date? {
  let attempts: [ISO8601DateFormatter.Options] = [
    [.withInternetDateTime, .withFractionalSeconds],
    [.withInternetDateTime],
  ]
  for options in attempts {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = options
    if let parsed = formatter.date(from: raw) { return parsed }
  }
  let dateOnly = DateFormatter()
  dateOnly.locale = Locale(identifier: "en_US_POSIX")
  dateOnly.timeZone = TimeZone(identifier: "UTC")
  dateOnly.dateFormat = "yyyy-MM-dd"
  return dateOnly.date(from: raw)
}

private let hourSeconds: Double = 3600
private let daySeconds: Double = 24 * hourSeconds

/// What to call a window of this length, when the provider did not name it.
public func windowLabel(seconds: Double?, fallback: String) -> String {
  guard let seconds, seconds.isFinite, seconds > 0 else { return fallback }
  if seconds <= 6 * hourSeconds { return Copy.fiveHourWindow }
  if seconds <= 2 * daySeconds { return Copy.dailyWindow }
  if seconds <= 10 * daySeconds { return Copy.weeklyWindow }
  return Copy.monthlyWindow
}
