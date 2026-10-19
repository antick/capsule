import Foundation

/// Something worth a macOS notification about a window.
public struct QuotaAlert: Sendable, Equatable {
  public enum Kind: Sendable, Equatable {
    /// Use crossed a threshold of what is left.
    case low(threshold: Int)
    /// The window started again.
    case reset
  }

  public var kind: Kind
  public var meter: MeterId
  public var meterName: String
  public var window: String
  /// What is left, in percent.
  public var left: Double
  /// A weekly window, which earns the celebration.
  public var weekly: Bool

  /// The notification's identifier: one per window and kind, so a repeat
  /// replaces rather than piles up.
  public var id: String {
    switch kind {
    case .low(let threshold): return "quota-\(meter.rawValue)-\(window)-\(threshold)"
    case .reset: return "reset-\(meter.rawValue)-\(window)"
    }
  }

  public var title: String {
    switch kind {
    case .low: return "\(meterName) · \(window)"
    case .reset: return "\(meterName) · \(window) \(Copy.alertResetTitle)"
    }
  }

  public var body: String {
    switch kind {
    case .low(let threshold):
      return "\(Int(left.rounded()))\(Copy.percentSuffix) \(Copy.left). \(Copy.alertCrossed) \(threshold)\(Copy.percentSuffix)."
    case .reset: return Copy.alertResetBody
    }
  }
}

/// What the tracker remembers per window, across launches.
public struct QuotaWindowState: Sendable, Codable, Equatable {
  public var left: Double
  public var fired: [Int]
  public var resetsAt: String
  /// The reset already announced, so a restart cannot announce it again.
  public var announcedReset: String?
}

public enum QuotaAlertRules {
  /// At or below this much used, a window has started again.
  public static let resetUsedPercent = 1.0
  public static let defaultThresholds = [50, 20]
  public static let stateFile = "quota-alerts.json"
}

/// The alerts these readings call for, and the state to remember. A window
/// seen for the first time is a baseline: nothing fires at launch.
public func evaluateQuotaAlerts(
  _ snapshots: [UsageSnapshot], thresholds: [Int], state: [String: QuotaWindowState]
) -> (alerts: [QuotaAlert], state: [String: QuotaWindowState]) {
  var next = state
  var alerts: [QuotaAlert] = []
  let ordered = Array(Set(thresholds.filter { $0 > 0 && $0 < 100 })).sorted(by: >)
  for snapshot in snapshots where snapshot.status == .ok {
    for bucket in snapshot.buckets {
      let key = "\(snapshot.meterId.rawValue)/\(bucket.id)"
      let left = 100 - max(0, min(100, bucket.percentUsed))
      let weekly = (WindowLengths.seconds(snapshot.providerId, bucket) ?? 0) >= WindowLengths.week
      func alert(_ kind: QuotaAlert.Kind) -> QuotaAlert {
        QuotaAlert(
          kind: kind, meter: snapshot.meterId, meterName: snapshot.displayName, window: bucket.label, left: left,
          weekly: weekly)
      }
      guard var window = state[key] else {
        // A baseline: what is already below a threshold counts as told.
        next[key] = QuotaWindowState(
          left: left, fired: ordered.filter { left <= Double($0) }, resetsAt: bucket.resetsAt, announcedReset: nil)
        continue
      }
      // A reset: the window's reset time moved on and its use fell. Where a
      // provider names no reset time, use falling to almost nothing.
      let usedBefore = 100 - window.left
      let movedOn = looseDate(bucket.resetsAt).flatMap { next in looseDate(window.resetsAt).map { next > $0 } }
      let reset =
        movedOn.map { $0 && bucket.percentUsed < usedBefore }
        ?? (usedBefore > QuotaAlertRules.resetUsedPercent && bucket.percentUsed <= QuotaAlertRules.resetUsedPercent)
      if reset, window.announcedReset != bucket.resetsAt {
        alerts.append(alert(.reset))
        window.announcedReset = bucket.resetsAt
      }
      // Recovered above a threshold: it can warn again next time.
      window.fired.removeAll { left > Double($0) }
      // Crossed downward: the lowest threshold passed, once, covering any
      // higher ones jumped past on the way.
      if let crossed = ordered.filter({ left <= Double($0) && window.left > Double($0) && !window.fired.contains($0) }).min() {
        alerts.append(alert(.low(threshold: crossed)))
        window.fired += ordered.filter { $0 >= crossed && !window.fired.contains($0) }
      }
      window.left = left
      window.resetsAt = bucket.resetsAt
      next[key] = window
    }
  }
  return (alerts, next)
}

extension CapsuleSettings {
  /// The thresholds in use, in percent left.
  public var effectiveThresholds: [Int] { alertThresholds.isEmpty ? QuotaAlertRules.defaultThresholds : alertThresholds }
}

/// The threshold sets offered in Settings.
public enum AlertPresets {
  public static let options: [[Int]] = [[50, 20], [25, 10], [10], [50, 25, 10]]
}

extension Copy {
  public static let alertResetTitle = "is back"
  public static let alertResetBody = "The window has reset. Full allowance again."
  public static let alertCrossed = "Passed your warning at"
  public static let quotaAlerts = "Warn when running low"
  public static let quotaAlertsHint = "A macOS notification when a window's share left crosses a threshold, once per crossing."
  public static let alertThresholds = "Warn at"
  public static let celebrateResets = "Celebrate weekly resets"
  public static let celebrateResetsHint = "A notification when a window starts again, and a short burst of confetti for a weekly one."
  public static let percentLeftSuffix = "% left"
}
