import Foundation

/// How the activity readers look for work, and how long they trust it.
public enum ActivityTuning {
  /// A Codex rollout write older than this is not a sign of a running turn.
  public static let codexStaleAfterMs = 8_000.0
}

/// Limits on activity notices.
public enum NoticeTuning {
  /// A completion found longer ago than this is history, not news.
  public static let maxEventAgeMs = 60_000.0
  public static let maxSummaryLength = 160
  public static let maxTitleLength = 120
  /// Notices kept at once; older ones fall off.
  public static let maxPending = 20
  /// Notice ids remembered, so one transition is never shown twice.
  public static let maxSeen = 1_000
}

/// Token counting from local logs.
public enum TokenTuning {
  /// Days in the longer window, today included.
  public static let historyDays = 30
  /// Remembered per-file totals, so a fresh launch skips unchanged history.
  public static let maxCacheEntries = 4_096
}

extension Copy {
  public static let surfaceDesktop = "Desktop"
  public static let surfaceVsCode = "VS Code"
  public static let surfaceAgent = "Agent"
  public static let surfaceTerminal = "Terminal"
  public static let codexRecent = "Recent activity · status unconfirmed"
  public static let localWorking = "Working · local task event"
  public static let localWaiting = "Waiting for your input"
}

/// One thing the dock tells you about without being asked: a turn finished,
/// or an agent is waiting on you.
public struct ActivityNotice: Sendable, Codable, Equatable {
  public enum Kind: String, Sendable, Codable { case completed, waiting }

  public var id: String
  public var sessionId: String
  public var providerId: ProviderId
  public var title: String
  public var kind: Kind
  public var at: String
  public var read: Bool?
  public var summary: String?

  public init(
    id: String, sessionId: String, providerId: ProviderId, title: String,
    kind: Kind, at: String, read: Bool? = nil, summary: String? = nil
  ) {
    self.id = id
    self.sessionId = sessionId
    self.providerId = providerId
    self.title = title
    self.kind = kind
    self.at = at
    self.read = read
    self.summary = summary
  }
}

/// How often usage is read.
public enum PollerTuning {
  /// While nobody is working, wait this long between reads: numbers that
  /// cannot have moved are not worth spending rate limit on.
  public static let idleIntervalMs = 300_000.0
}
