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
  public static let sampleSeconds = 600.0
  /// How far back the history reaches, and the most kept per window.
  public static let keepSeconds = 14 * 86_400.0
  public static let maxSamples = 2_016
  /// What the charts show.
  public static let chartSeconds = 7 * 86_400.0
  public static let file = "usage-history.json"
  public static let sparklineHeight = 36.0
  public static let chartHeight = 160.0
}

/// The history with these readings added: a window's reading is kept when
/// it moved or enough time passed, and old readings are let go.
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
      next[key] = samples
    }
  }
  for (key, samples) in next {
    let kept = samples.filter { stamp - $0.at <= HistoryTuning.keepSeconds }.suffix(HistoryTuning.maxSamples)
    next[key] = kept.isEmpty ? nil : Array(kept)
  }
  return next
}

/// A window's readings inside the charts' span, oldest first.
public func chartSamples(_ history: UsageHistory, _ key: MetricKey, now: Date) -> [UsageSample] {
  let floor = now.timeIntervalSince1970 - HistoryTuning.chartSeconds
  return (history[key.rawValue] ?? []).filter { $0.at >= floor }
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
