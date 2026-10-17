import Foundation

public enum ProviderId: String, Sendable, Codable, CaseIterable {
  case claude, codex, grok, cursor, copilot
}

public enum UsageStatus: String, Sendable, Codable {
  case ok, unauthenticated, error, stale, disabled
}

public struct UsageBucket: Sendable, Codable, Equatable {
  public var id: String
  public var label: String
  public var percentUsed: Double
  public var resetsAt: String
  public var resetStyle: ResetStyle

  public init(
    id: String,
    label: String,
    percentUsed: Double,
    resetsAt: String,
    resetStyle: ResetStyle
  ) {
    self.id = id
    self.label = label
    self.percentUsed = percentUsed
    self.resetsAt = resetsAt
    self.resetStyle = resetStyle
  }
}

public struct UsageSnapshot: Sendable, Codable, Equatable {
  public var providerId: ProviderId
  public var displayName: String
  public var iconId: ProviderId
  /// Absent, not zero, when nothing was read. A provider that reported
  /// nothing is not a provider at zero usage.
  public var primaryPercent: Double?
  public var buckets: [UsageBucket]
  public var status: UsageStatus
  public var fetchedAt: String
  /// A fetch for this provider is in the air. The last good numbers stay on
  /// screen while it runs; the meter just says so with a sweep round its ring.
  public var refreshing: Bool?
  /// When the numbers on screen were last actually read, once they have gone
  /// stale. A remembered reading has to be dated, or it quietly passes itself
  /// off as live.
  public var staleSince: String?

  public init(
    providerId: ProviderId,
    displayName: String,
    iconId: ProviderId,
    primaryPercent: Double?,
    buckets: [UsageBucket],
    status: UsageStatus,
    fetchedAt: String,
    refreshing: Bool? = nil,
    staleSince: String? = nil
  ) {
    self.providerId = providerId
    self.displayName = displayName
    self.iconId = iconId
    self.primaryPercent = primaryPercent
    self.buckets = buckets
    self.status = status
    self.fetchedAt = fetchedAt
    self.refreshing = refreshing
    self.staleSince = staleSince
  }
}

public enum ProviderLabels {
  public static let all: [ProviderId: String] = [
    .claude: "Claude",
    .codex: "Codex",
    .grok: "Grok",
    .cursor: "Cursor",
    .copilot: "Copilot",
  ]

  public static func label(_ id: ProviderId) -> String {
    all[id] ?? id.rawValue
  }
}

/// User-visible strings. The only place they live, so a label cannot drift
/// between the dock and a provider mapper.
public enum Copy {
  public static let currentSession = "Current session"
  public static let allModels = "All models"
  public static let fiveHourWindow = "5-hour window"
  public static let weeklyWindow = "Weekly"
  public static let dailyWindow = "Daily"
  public static let monthlyWindow = "Monthly"
  public static let grokWeekly = "Weekly credits"
  public static let grokOnDemand = "On-demand"
  public static let grokBuild = "Grok Build"
  public static let cursorPlan = "Plan usage"
  public static let copilotPremium = "Premium requests"
  public static let copilotChat = "Chat"
}

/// How long to wait after a rate-limited read. Milliseconds, matching the
/// fixture corpus; the app converts at the edges.
public enum BackoffPolicy {
  public static let floorMs = 60_000
  public static let ceilingMs = 15 * 60_000
  public static let maxDoublings = 4
}

/// `2026-08-27T12:13:00.000Z` — the shape JavaScript's `toISOString` produces,
/// which is what the corpus and the persisted snapshots both carry.
public func isoString(_ date: Date) -> String {
  let formatter = ISO8601DateFormatter()
  formatter.timeZone = TimeZone(identifier: "UTC")
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.string(from: date)
}
