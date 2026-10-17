import Foundation

/// Formatters are expensive to build and the readers parse dates on every
/// refresh, so each is built once. `DateFormatter` is `Sendable` in the SDK;
/// `ISO8601DateFormatter` is not marked so, but is documented thread-safe once
/// configured, and these are never mutated after this point, which is what
/// makes the unchecked sharing of those three sound.
private enum Formatters {
  nonisolated(unsafe) static let isoFractional: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  nonisolated(unsafe) static let iso: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  static let dateOnly: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
  }()

  nonisolated(unsafe) static let isoOutput: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}

/// The date forms providers actually send: a full ISO timestamp with or
/// without fractional seconds, and a bare `2026-09-01`, which JavaScript reads
/// as UTC midnight. Deliberately narrower than `new Date(string)`, whose
/// lenient fallbacks differ between engines.
public func looseDate(_ raw: String) -> Date? {
  Formatters.isoFractional.date(from: raw)
    ?? Formatters.iso.date(from: raw)
    ?? Formatters.dateOnly.date(from: raw)
}

/// `2026-08-27T12:13:00.000Z` — the shape JavaScript's `toISOString` produces,
/// which is what the corpus and the persisted snapshots both carry.
public func isoString(_ date: Date) -> String {
  Formatters.isoOutput.string(from: date)
}
