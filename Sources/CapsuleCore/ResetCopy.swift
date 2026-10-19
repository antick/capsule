import Foundation

public enum Durations {
  public static let minute: TimeInterval = 60
  public static let hour: TimeInterval = 60 * minute
  public static let day: TimeInterval = 24 * hour
}

/// How reset copy is written. `relative` counts down, `absolute` names a time.
public enum ResetStyle: String, Sendable, Codable {
  case relative, absolute
}

/// Copy for a reset less than a day out: "Resets in 51 min",
/// "Resets in 2h 10 min".
public func formatResetRelative(_ resetsAt: Date, now: Date) -> String {
  let delta = max(0, resetsAt.timeIntervalSince(now))
  let totalMinutes = Int((delta / Durations.minute).rounded())
  if totalMinutes < 60 {
    return "Resets in \(totalMinutes) min"
  }
  return "Resets in \(totalMinutes / 60)h \(totalMinutes % 60) min"
}

/// "Resets today 3:00 PM", "Resets tomorrow 12:00 AM", else the weekday. A
/// weekday for something happening in a few hours reads like a calendar;
/// "today" reads like a clock.
public func formatResetAbsolute(
  _ resetsAt: Date,
  locale: Locale = Locale(identifier: "en_US"),
  now: Date,
  timeZone: TimeZone = .current
) -> String {
  let time = clockTime(resetsAt, locale: locale, timeZone: timeZone)
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = timeZone
  calendar.locale = locale

  if calendar.isDate(resetsAt, inSameDayAs: now) {
    return "Resets today \(time)"
  }
  if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now),
    calendar.isDate(resetsAt, inSameDayAs: tomorrow)
  {
    return "Resets tomorrow \(time)"
  }
  return "Resets \(weekday(resetsAt, locale: locale, timeZone: timeZone)) \(time)"
}

/// A span ahead, short: "12 min", "2h 10 min", "3d 4h".
public func formatSpan(_ seconds: TimeInterval) -> String {
  let totalMinutes = Int((max(0, seconds) / Durations.minute).rounded())
  if totalMinutes < 60 { return "\(totalMinutes) min" }
  let totalHours = totalMinutes / 60
  if totalHours < 24 { return "\(totalHours)h \(totalMinutes % 60) min" }
  return "\(totalHours / 24)d \(totalHours % 24)h"
}

/// A countdown at any distance, for a reset the user asked to see counted:
/// "Resets in 3d 4h".
public func formatResetCountdown(_ resetsAt: Date, now: Date) -> String {
  "Resets in \(formatSpan(resetsAt.timeIntervalSince(now)))"
}

/// The reset as the user chose to read it: the window's own style, or the
/// other one when flipped. A flipped countdown counts days too.
public func formatResetCopy(
  _ resetsAt: Date, style: ResetStyle, flipped: Bool, now: Date
) -> String {
  guard flipped else { return formatResetCopy(resetsAt, style: style, now: now) }
  return style == .relative ? formatResetAbsolute(resetsAt, now: now) : formatResetCountdown(resetsAt, now: now)
}

public func formatResetCopy(
  _ resetsAt: Date,
  style: ResetStyle,
  now: Date,
  locale: Locale = Locale(identifier: "en_US"),
  timeZone: TimeZone = .current
) -> String {
  if style == .relative {
    let delta = max(0, resetsAt.timeIntervalSince(now))
    if delta < Durations.day {
      return formatResetRelative(resetsAt, now: now)
    }
  }
  return formatResetAbsolute(
    resetsAt, locale: locale, now: now, timeZone: timeZone
  )
}

/// Under this many seconds, a span is "just now" rather than a number.
private let justNowSeconds: TimeInterval = 45

/// How long something has been the way it is: "just now", "3 min", "2 hr",
/// "2 hr 5 min". The second half of answering "is Claude still working".
public func formatElapsed(since: Date, now: Date) -> String {
  let seconds = max(0, now.timeIntervalSince(since))
  if seconds < justNowSeconds { return "just now" }
  let minutes = Int((seconds / Durations.minute).rounded())
  if minutes < 60 { return "\(max(1, minutes)) min" }
  let hours = minutes / 60
  let rest = minutes % 60
  return rest == 0 ? "\(hours) hr" : "\(hours) hr \(rest) min"
}

/// The same span, phrased as a point in the past.
public func formatAgo(since: Date, now: Date) -> String {
  let elapsed = formatElapsed(since: since, now: now)
  return elapsed == "just now" ? elapsed : "\(elapsed) ago"
}

// MARK: - Formatting

/// `3:00 PM`, with an ordinary space before the meridiem.
///
/// Modern Foundation puts U+202F NARROW NO-BREAK SPACE before AM/PM in
/// `en_US` when the time comes from `Date.FormatStyle` or a `timeStyle`, while
/// the JavaScript this copy was written against emits U+0020. An explicit
/// `dateFormat` template avoids it today — verified on macOS 26 — so the
/// replacement below is a guard, not a fix for current behaviour. It stays
/// because these strings are user-visible and shared with the fixture corpus,
/// and `ResetCopyTests` would otherwise only notice the day a toolchain
/// changed its mind.
private func clockTime(_ date: Date, locale: Locale, timeZone: TimeZone)
  -> String
{
  let formatter = DateFormatter()
  formatter.locale = locale
  formatter.timeZone = timeZone
  formatter.dateFormat = "h:mm a"
  return formatter.string(from: date).replacingOccurrences(
    of: "\u{202F}", with: " "
  )
}

private func weekday(_ date: Date, locale: Locale, timeZone: TimeZone) -> String
{
  let formatter = DateFormatter()
  formatter.locale = locale
  formatter.timeZone = timeZone
  formatter.dateFormat = "EEE"
  return formatter.string(from: date)
}
