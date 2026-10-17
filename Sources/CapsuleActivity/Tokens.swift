import CapsuleCore
import Foundation

/// Tokens billed at one moment.
public struct TokenRow: Sendable, Equatable {
  public var at: Date
  public var tokens: Double
}

/// Tokens per local day, keyed "YYYY-MM-DD".
public typealias DayHistogram = [String: Double]

/// One log file's remembered totals, keyed by its size and date. Session logs
/// are appended to, never rewritten, so an unchanged size and date means
/// unchanged contents.
public struct TokenFileEntry: Sendable, Codable, Equatable {
  public var size: Double
  public var modifiedMs: Double
  public var days: DayHistogram

  public init(size: Double, modifiedMs: Double, days: DayHistogram) {
    self.size = size
    self.modifiedMs = modifiedMs
    self.days = days
  }
}

private func count(_ value: JSONValue?) -> Double {
  guard let number = value?.asDouble, number.isFinite else { return 0 }
  return number
}

/// A row's time. Epoch numbers under `1e11` are seconds — the token logs'
/// own threshold, deliberately not the usage readers' `1e12`.
private func when(_ value: JSONValue?) -> Date? {
  switch value {
  case .string(let text): return looseDate(text)
  case .number(let number) where number.isFinite:
    return jsDate(milliseconds: number > 1e11 ? number : number * 1000)
  default: return nil
  }
}

/// A Claude Code transcript row: each assistant message carries the usage the
/// API billed for it. Cache reads and writes are tokens too, so they count.
public func claudeRowTokens(_ row: JSONValue) -> TokenRow? {
  guard let record = row.asObject,
    let usage = record["message"]?["usage"]?.asObject,
    let at = when(record["timestamp"])
  else { return nil }
  let tokens =
    count(usage["input_tokens"]) + count(usage["cache_read_input_tokens"])
    + count(usage["cache_creation_input_tokens"]) + count(usage["output_tokens"])
  return tokens > 0 ? TokenRow(at: at, tokens: tokens) : nil
}

/// A Codex rollout reports a running total each turn rather than a delta, so
/// the previous total is carried along in `previous`. A total that goes down
/// is a new thread in the same file, which counts from there. A row without
/// totals leaves the carried total alone.
public func codexRowTokens(_ row: JSONValue, previous: inout Double) -> TokenRow? {
  let totals = row["payload"]?["info"]?["total_token_usage"]
  // Any truthy total counts, as in the original: a value that is not an
  // object reads as zero tokens, but it still moves the carried total.
  guard row.asObject != nil,
    row["payload"]?["type"]?.asString == "token_count",
    jsTruthy(totals),
    let at = when(row["timestamp"])
  else { return nil }
  let total = totals?.asObject ?? [:]
  let cumulative = count(total["input_tokens"]) + count(total["output_tokens"])
  let delta = cumulative >= previous ? cumulative - previous : cumulative
  previous = cumulative
  return delta > 0 ? TokenRow(at: at, tokens: delta) : nil
}

public struct TokenTotals: Sendable, Codable, Equatable {
  public var today: Double
  public var month: Double
}

/// Today's and the window's totals from a histogram, as of `now`. The window
/// is the last ``TokenTuning/historyDays`` days, today included.
public func histogramTotals(
  _ days: DayHistogram, now: Date, timeZone: TimeZone = .current
) -> TokenTotals {
  let today = dayKey(now, timeZone: timeZone)
  let floor = dayKey(
    startOfDay(now, daysAgo: TokenTuning.historyDays - 1, timeZone: timeZone),
    timeZone: timeZone
  )
  let month = days.filter { $0.key >= floor && $0.key <= today }.values.reduce(0, +)
  return TokenTotals(today: days[today] ?? 0, month: month)
}

/// Forget files that are gone, newest kept first, up to the cache's limit.
///
/// Files with the same date are ordered by path. The original keeps them in
/// the order the cache object held them, which a Swift dictionary cannot
/// reproduce; this makes the tie-break explicit instead of accidental.
public func pruneTokenCache(
  _ cache: [String: TokenFileEntry], keep: Set<String>
) -> [(path: String, entry: TokenFileEntry)] {
  cache
    .filter { keep.contains($0.key) }
    .sorted {
      $0.value.modifiedMs != $1.value.modifiedMs
        ? $0.value.modifiedMs > $1.value.modifiedMs : $0.key < $1.key
    }
    .prefix(TokenTuning.maxCacheEntries)
    .map { (path: $0.key, entry: $0.value) }
}
