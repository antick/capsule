import Foundation

/// A day, named in the zone the user is in: `2026-09-06`.
public func dayKey(_ date: Date, timeZone: TimeZone = .current) -> String {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = timeZone
  let parts = calendar.dateComponents([.year, .month, .day], from: date)
  return String(
    format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0
  )
}

/// Local midnight `daysAgo` days before `now`.
public func startOfDay(
  _ now: Date, daysAgo: Int = 0, timeZone: TimeZone = .current
) -> Date {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = timeZone
  let midnight = calendar.startOfDay(for: now)
  return calendar.date(byAdding: .day, value: -daysAgo, to: midnight) ?? midnight
}

/// "1.2m", "840k", "12": compact, and rounded so the card's column never
/// jumps width as the number climbs.
public func formatCompactCount(_ value: Double) -> String {
  let magnitude = abs(value)
  let sign = value < 0 ? "-" : ""

  func scaled(_ n: Double, _ suffix: String) -> String {
    let digits = n >= 100 ? 0 : n >= 10 ? 1 : 2
    var text = String(format: "%.\(digits)f", n)
    if text.contains(".") {
      while text.hasSuffix("0") { text.removeLast() }
      if text.hasSuffix(".") { text.removeLast() }
    }
    return "\(sign)\(text)\(suffix)"
  }

  if magnitude >= 1e9 { return scaled(magnitude / 1e9, "b") }
  if magnitude >= 1e6 { return scaled(magnitude / 1e6, "m") }
  if magnitude >= 1e3 { return scaled(magnitude / 1e3, "k") }
  return "\(sign)\(Int(magnitude.rounded()))"
}
