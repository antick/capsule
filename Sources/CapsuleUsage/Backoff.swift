import CapsuleCore
import Foundation

/// The endpoint said no, for now. Carries the server's own hint and, where the
/// provider had something remembered to show instead, the snapshot to show
/// while the penalty runs.
public struct RateLimited: Error, Sendable {
  public let retryAfterMs: Int?
  public let fallback: UsageSnapshot?

  public init(retryAfterMs: Int?, fallback: UsageSnapshot? = nil) {
    self.retryAfterMs = retryAfterMs
    self.fallback = fallback
  }
}

/// How long to wait after the `refusals`th 429 in a row. The hint is only ever
/// a floor-raiser: the wait starts at a minute, doubles per consecutive
/// refusal, and is capped so it always recovers by itself.
public func backoffMs(refusals: Int, retryAfterMs hint: Int?) -> Int {
  let doublings = min(max(0, refusals - 1), BackoffPolicy.maxDoublings)
  let doubled = BackoffPolicy.floorMs * (1 << doublings)
  return min(BackoffPolicy.ceilingMs, max(doubled, hint ?? 0))
}

/// `Retry-After` is either a number of seconds or an HTTP date.
public func retryAfterMs(header: String?, now: Date) -> Int? {
  guard let header, !header.isEmpty else { return nil }
  let trimmed = header.trimmingCharacters(in: .whitespacesAndNewlines)

  // JavaScript's `Number("")` is 0, and the original reads a blank header as
  // "wait no time at all" rather than "no hint". Kept so the two agree.
  if trimmed.isEmpty { return 0 }

  if let seconds = Double(trimmed), seconds.isFinite {
    return max(0, Int((seconds * 1000).rounded()))
  }
  guard let date = httpDate(trimmed) else { return nil }
  return max(0, Int((date.timeIntervalSince(now) * 1000).rounded()))
}

/// `Thu, 27 Aug 2026 11:23:00 GMT`, the form `Retry-After` uses when it is not
/// a count of seconds.
private func httpDate(_ raw: String) -> Date? {
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(identifier: "GMT")
  for format in [
    "EEE, dd MMM yyyy HH:mm:ss zzz",
    "EEEE, dd-MMM-yy HH:mm:ss zzz",
    "EEE MMM d HH:mm:ss yyyy",
  ] {
    formatter.dateFormat = format
    if let parsed = formatter.date(from: raw) { return parsed }
  }
  return nil
}
