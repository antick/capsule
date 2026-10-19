import CapsuleCore
import Foundation

/// A row parser for one file. Codex carries a running total from row to row,
/// so a fresh parser is made for every file.
public typealias TokenRowParser = (JSONValue) -> TokenRow?

/// One file's rows inside the window, as histograms of its days: tokens,
/// and spend when the rows carry it. A request written more than once
/// counts once, as its largest copy: a streamed message's final one. Nil
/// when the file could not be read.
private func histogramOf(
  _ host: TokenScanHost, _ file: LogFile, floor: Date, timeZone: TimeZone, parse: TokenRowParser
) async -> TokenFileEntry? {
  var keyed: [String: TokenRow] = [:]
  var rows: [TokenRow] = []
  let ok = await host.eachLine(file.path) { line in
    // Measured as JavaScript measures a string: in UTF-16 code units.
    let length = line.utf16.count
    guard length > 0, length <= TokenTuning.maxLineLength, let row = JSONValue.parse(line),
      let hit = parse(row), hit.at >= floor
    else { return }
    guard let key = hit.key else { return rows.append(hit) }
    if let kept = keyed[key], kept.tokens >= hit.tokens { return }
    keyed[key] = hit
  }
  guard ok else { return nil }
  var days: DayHistogram = [:]
  var cost: DayHistogram = [:]
  var unpriced: Set<String> = []
  for hit in rows + keyed.values {
    let day = dayKey(hit.at, timeZone: timeZone)
    days[day, default: 0] += hit.tokens
    if let spent = hit.cost { cost[day, default: 0] += spent }
    if hit.unpriced { unpriced.insert(day) }
  }
  return TokenFileEntry(
    size: file.size, modifiedMs: file.modifiedMs, days: days, cost: cost.isEmpty && unpriced.isEmpty ? nil : cost,
    unpricedDays: unpriced.isEmpty ? nil : unpriced.sorted())
}

/// Totals for one provider's logs, reading only files that changed since last
/// time, and only rows inside the window. A file last written before the
/// window opened cannot hold anything that counts, so it is not opened.
public func scanTokenLogs(
  _ host: TokenScanHost, root: String, cache: inout [String: TokenFileEntry], now: Date,
  timeZone: TimeZone = .current, priced: Bool = false, parser: () -> TokenRowParser
) async -> (days: DayHistogram, touched: [String]) {
  let result = await scanLogs(host, root: root, cache: &cache, now: now, timeZone: timeZone, priced: priced, parser: parser)
  return (result.days, result.touched)
}

/// A provider's logs, summed: tokens and spend per day, the days holding a
/// row with no known price, and every file looked at.
public struct LogTotals: Sendable {
  public var days: DayHistogram = [:]
  public var cost: DayHistogram = [:]
  public var unpricedDays: Set<String> = []
  public var touched: [String] = []
}

/// The scan itself. With `priced`, a cached file from before spend was
/// counted is read again, once, so its spend is known.
public func scanLogs(
  _ host: TokenScanHost, root: String, cache: inout [String: TokenFileEntry], now: Date,
  timeZone: TimeZone = .current, priced: Bool, parser: () -> TokenRowParser
) async -> LogTotals {
  let floor = startOfDay(now, daysAgo: TokenTuning.historyDays - 1, timeZone: timeZone)
  let floorMs = floor.timeIntervalSince1970 * 1000
  var totals = LogTotals()
  var seen: Set<String> = []
  for file in await host.walk(root) where file.path.hasSuffix(".jsonl") {
    if seen.insert(file.path).inserted { totals.touched.append(file.path) }
    var entry = cache[file.path]
    let stale = priced && entry?.cost == nil && file.modifiedMs >= floorMs && !(entry?.days.isEmpty ?? true)
    if entry == nil || entry?.size != file.size || entry?.modifiedMs != file.modifiedMs || stale {
      if file.modifiedMs < floorMs {
        entry = TokenFileEntry(size: file.size, modifiedMs: file.modifiedMs, days: [:])
      } else {
        guard let read = await histogramOf(host, file, floor: floor, timeZone: timeZone, parse: parser())
        else { continue }
        entry = read
        // Read with prices: mark it so, even when nothing in it had a cost,
        // or it would be read again on every scan.
        if priced, entry?.cost == nil { entry?.cost = [:] }
      }
      cache[file.path] = entry
    }
    for (day, tokens) in entry?.days ?? [:] { totals.days[day, default: 0] += tokens }
    for (day, spent) in entry?.cost ?? [:] { totals.cost[day, default: 0] += spent }
    totals.unpricedDays.formUnion(entry?.unpricedDays ?? [])
  }
  return totals
}

/// Counts the tokens each provider's agents have got through, from the logs
/// they keep locally, and says so whenever the answer changes.
public actor TokenScanner {
  private let host: TokenScanHost
  private let enabled: @Sendable () -> [ProviderId]
  private let onChange: @Sendable ([ProviderId: TokenUsage]) -> Void
  private let timeZone: TimeZone
  /// Model prices, when spend is wanted; nil counts tokens only.
  private let prices: @Sendable () -> PriceTable?
  public private(set) var tokens: [ProviderId: TokenUsage] = [:]
  private var cache: [String: TokenFileEntry]
  private var inFlight: Task<Void, Never>?

  public init(
    host: TokenScanHost, enabled: @escaping @Sendable () -> [ProviderId],
    onChange: @escaping @Sendable ([ProviderId: TokenUsage]) -> Void, timeZone: TimeZone = .current,
    prices: @escaping @Sendable () -> PriceTable? = { nil }
  ) {
    self.host = host
    self.prices = prices
    self.enabled = enabled
    self.onChange = onChange
    self.timeZone = timeZone
    self.cache = host.loadTokenCache()
  }

  /// Where each provider keeps its logs, and how a row of them reads.
  private static func sources(_ prices: PriceTable?) -> [(ProviderId, [String], () -> TokenRowParser)] {
    [
      (.claude, TokenTuning.claudeLogsDir, { { claudeRowUsage($0, prices: prices) } }),
      (
        .codex, TokenTuning.codexLogsDir,
        {
          let reader = CodexRowReader(prices: prices)
          return { reader.read($0) }
        }
      ),
      (.grok, TokenTuning.grokLogsDir, { grokRowUsage }),
    ]
  }

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
    let table = prices()
    for (id, segments, parser) in Self.sources(table) where wanted.contains(id) {
      let scanned = await scanLogs(
        host, root: joinPath(host.homeDir, segments), cache: &working, now: now, timeZone: timeZone,
        priced: table != nil, parser: parser
      )
      keep.formUnion(scanned.touched)
      let totals = histogramTotals(scanned.days, now: now, timeZone: timeZone)
      if totals.month > 0 {
        var usage = TokenUsage(
          providerId: id, todayTokens: totals.today, monthTokens: totals.month, scannedAt: isoString(now)
        )
        if !scanned.cost.isEmpty {
          let spend = histogramTotals(scanned.cost, now: now, timeZone: timeZone)
          let window = Set(scanned.days.keys).union(scanned.cost.keys)
          usage.todayCost = spend.today
          usage.monthCost = spend.month
          usage.costPartial = scanned.unpricedDays.isDisjoint(with: window) ? nil : true
        }
        next[id] = usage
      }
    }
    cache = Dictionary(
      uniqueKeysWithValues: pruneTokenCache(working, keep: keep).map { ($0.path, $0.entry) }
    )
    host.saveTokenCache(cache)
    let changed = Set(tokens.keys).union(next.keys).contains {
      tokens[$0]?.todayTokens != next[$0]?.todayTokens || tokens[$0]?.monthTokens != next[$0]?.monthTokens
        || tokens[$0]?.todayCost != next[$0]?.todayCost || tokens[$0]?.monthCost != next[$0]?.monthCost
    }
    if changed {
      tokens = next
      onChange(tokens)
    }
  }
}
