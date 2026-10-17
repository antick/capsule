import CapsuleCore
import Foundation

/// A row parser for one file. Codex carries a running total from row to row,
/// so a fresh parser is made for every file.
public typealias TokenRowParser = (JSONValue) -> TokenRow?

/// One file's rows inside the window, as a histogram of its days. Nil when the
/// file could not be read.
private func histogramOf(
  _ host: TokenScanHost, _ file: LogFile, floor: Date, timeZone: TimeZone, parse: TokenRowParser
) async -> DayHistogram? {
  var days: DayHistogram = [:]
  let ok = await host.eachLine(file.path) { line in
    // Measured as JavaScript measures a string: in UTF-16 code units.
    let length = line.utf16.count
    guard length > 0, length <= TokenTuning.maxLineLength, let row = JSONValue.parse(line),
      let hit = parse(row), hit.at >= floor
    else { return }
    days[dayKey(hit.at, timeZone: timeZone), default: 0] += hit.tokens
  }
  return ok ? days : nil
}

/// Totals for one provider's logs, reading only files that changed since last
/// time, and only rows inside the window. A file last written before the
/// window opened cannot hold anything that counts, so it is not opened.
public func scanTokenLogs(
  _ host: TokenScanHost, root: String, cache: inout [String: TokenFileEntry], now: Date,
  timeZone: TimeZone = .current, parser: () -> TokenRowParser
) async -> (days: DayHistogram, touched: [String]) {
  let floor = startOfDay(now, daysAgo: TokenTuning.historyDays - 1, timeZone: timeZone)
  let floorMs = floor.timeIntervalSince1970 * 1000
  var days: DayHistogram = [:]
  var touched: [String] = []
  for file in await host.walk(root) where file.path.hasSuffix(".jsonl") {
    if !touched.contains(file.path) { touched.append(file.path) }
    var entry = cache[file.path]
    if entry == nil || entry?.size != file.size || entry?.modifiedMs != file.modifiedMs {
      if file.modifiedMs < floorMs {
        entry = TokenFileEntry(size: file.size, modifiedMs: file.modifiedMs, days: [:])
      } else {
        guard let read = await histogramOf(host, file, floor: floor, timeZone: timeZone, parse: parser())
        else { continue }
        entry = TokenFileEntry(size: file.size, modifiedMs: file.modifiedMs, days: read)
      }
      cache[file.path] = entry
    }
    for (day, tokens) in entry?.days ?? [:] { days[day, default: 0] += tokens }
  }
  return (days, touched)
}

/// Counts the tokens each provider's agents have got through, from the logs
/// they keep locally, and says so whenever the answer changes.
public actor TokenScanner {
  private let host: TokenScanHost
  private let enabled: @Sendable () -> [ProviderId]
  private let onChange: @Sendable ([ProviderId: TokenUsage]) -> Void
  private let timeZone: TimeZone
  public private(set) var tokens: [ProviderId: TokenUsage] = [:]
  private var cache: [String: TokenFileEntry]
  private var inFlight: Task<Void, Never>?

  public init(
    host: TokenScanHost, enabled: @escaping @Sendable () -> [ProviderId],
    onChange: @escaping @Sendable ([ProviderId: TokenUsage]) -> Void, timeZone: TimeZone = .current
  ) {
    self.host = host
    self.enabled = enabled
    self.onChange = onChange
    self.timeZone = timeZone
    self.cache = host.loadTokenCache()
  }

  /// Where each provider keeps its logs, and how a row of them reads.
  private static let sources: [(ProviderId, [String], @Sendable () -> TokenRowParser)] = [
    (.claude, TokenTuning.claudeLogsDir, { claudeRowTokens }),
    (
      .codex, TokenTuning.codexLogsDir,
      {
        var previous = 0.0
        return { codexRowTokens($0, previous: &previous) }
      }
    ),
  ]

  /// Re-reads every enabled provider's logs. A rescan already running is the
  /// answer to a second request for one.
  public func rescan() async {
    if let inFlight {
      await inFlight.value
      return
    }
    let task = Task { await self.rescanBody() }
    inFlight = task
    await task.value
    inFlight = nil
  }

  private func rescanBody() async {
    let wanted = Set(enabled())
    var working = cache
    let now = host.now()
    var next: [ProviderId: TokenUsage] = [:]
    var keep: Set<String> = []
    for (id, segments, parser) in Self.sources where wanted.contains(id) {
      let (days, touched) = await scanTokenLogs(
        host, root: joinPath(host.homeDir, segments), cache: &working, now: now, timeZone: timeZone,
        parser: parser
      )
      keep.formUnion(touched)
      let totals = histogramTotals(days, now: now, timeZone: timeZone)
      if totals.month > 0 {
        next[id] = TokenUsage(
          providerId: id, todayTokens: totals.today, monthTokens: totals.month, scannedAt: isoString(now)
        )
      }
    }
    cache = Dictionary(
      uniqueKeysWithValues: pruneTokenCache(working, keep: keep).map { ($0.path, $0.entry) }
    )
    host.saveTokenCache(cache)
    let changed = Set(tokens.keys).union(next.keys).contains {
      tokens[$0]?.todayTokens != next[$0]?.todayTokens || tokens[$0]?.monthTokens != next[$0]?.monthTokens
    }
    if changed {
      tokens = next
      onChange(tokens)
    }
  }
}
