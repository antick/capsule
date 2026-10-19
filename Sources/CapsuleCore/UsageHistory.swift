import Foundation

/// One reading of one window at one moment.
public struct UsageSample: Sendable, Codable, Equatable {
  /// Seconds since 1970.
  public var at: Double
  public var percent: Double

  public init(at: Double, percent: Double) {
    self.at = at
    self.percent = percent
  }
}

/// Every window's readings over time, keyed by `MetricKey.rawValue`.
public typealias UsageHistory = [String: [UsageSample]]

public enum HistoryTuning {
  /// A reading is kept when it moved this many points, or this long has
  /// passed since the last one kept.
  public static let minimumMove = 1.0
  public static let sampleSeconds = 3_600.0
  /// How far back the history reaches, and the most kept per window.
  public static let keepSeconds = 14 * 86_400.0
  public static let maxSamples = 1_000
  /// The most points one window draws in a chart.
  public static let maxChartPoints = 300
  /// How long after a change the history waits before it is written down.
  public static let saveDelaySeconds = 30.0
  /// What the charts show.
  public static let chartSeconds = 7 * 86_400.0
  public static let file = "usage-history.json"
  public static let sparklineHeight = 36.0
  public static let chartHeight = 160.0
}

/// The history with these readings added: a window's reading is kept when
/// it moved a point, or an hour passed since the last one kept (a stepped
/// chart needs no more). Only windows that gained a reading are pruned;
/// ``pruneHistory(_:now:)`` does the rest once, at launch.
public func recordHistory(_ history: UsageHistory, _ snapshots: [UsageSnapshot], now: Date) -> UsageHistory {
  var next = history
  let stamp = now.timeIntervalSince1970
  for snapshot in snapshots where snapshot.status == .ok {
    for bucket in snapshot.buckets {
      let key = MetricKey(snapshot.meterId, bucket.id).rawValue
      var samples = next[key] ?? []
      let percent = max(0, min(100, bucket.percentUsed))
      if let last = samples.last,
        abs(last.percent - percent) < HistoryTuning.minimumMove, stamp - last.at < HistoryTuning.sampleSeconds
      {
        continue
      }
      samples.append(UsageSample(at: stamp, percent: percent))
      let floor = stamp - HistoryTuning.keepSeconds
      if let first = samples.first, first.at < floor { samples.removeAll { $0.at < floor } }
      if samples.count > HistoryTuning.maxSamples { samples.removeFirst(samples.count - HistoryTuning.maxSamples) }
      next[key] = samples
    }
  }
  return next
}

/// Lets go of everything older than the history keeps, for every window.
public func pruneHistory(_ history: UsageHistory, now: Date) -> UsageHistory {
  let floor = now.timeIntervalSince1970 - HistoryTuning.keepSeconds
  return history.compactMapValues { samples in
    let kept = samples.filter { $0.at >= floor }.suffix(HistoryTuning.maxSamples)
    return kept.isEmpty ? nil : Array(kept)
  }
}

/// A window's readings inside the charts' span, oldest first, thinned to
/// what a chart can show: every reading when there are few, an even spread
/// that keeps the latest when there are many.
public func chartSamples(_ history: UsageHistory, _ key: MetricKey, now: Date) -> [UsageSample] {
  let floor = now.timeIntervalSince1970 - HistoryTuning.chartSeconds
  let inside = (history[key.rawValue] ?? []).filter { $0.at >= floor }
  guard inside.count > HistoryTuning.maxChartPoints else { return inside }
  let step = Double(inside.count - 1) / Double(HistoryTuning.maxChartPoints - 1)
  return (0..<HistoryTuning.maxChartPoints).map { inside[Int((Double($0) * step).rounded())] }
}

extension Copy {
  public static let history = "History"
  public static let historyHint = "Each window's use over the last seven days, as Capsule read it. The history fills in as Capsule runs."
  public static let noHistoryYet = "No readings recorded yet."
}

/// A chart's day label: "Mon 19".
public func formatChartDay(_ date: Date, locale: Locale = Locale(identifier: "en_US"), timeZone: TimeZone = .current)
  -> String
{
  let formatter = DateFormatter()
  formatter.locale = locale
  formatter.timeZone = timeZone
  formatter.dateFormat = "EEE d"
  return formatter.string(from: date)
}
