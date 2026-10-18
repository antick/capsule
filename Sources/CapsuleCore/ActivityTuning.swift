import Foundation

/// How the activity readers look for work, and how long they trust it.
public enum ActivityTuning {
  /// A Codex rollout write older than this is not a sign of a running turn.
  public static let codexStaleAfterMs = 8_000.0
  /// How often the monitor looks again without a file event to prompt it.
  public static let pollMs = 2_000.0
  /// A burst of session-file writes becomes one rescan this long after the last.
  public static let watchDebounceMs = 120.0
  /// A process whose start differs from the record's by more than this is a
  /// different process that happens to have the same pid.
  public static let pidReuseToleranceMs = 300_000.0
  /// Days of Codex's dated rollout folders worth scanning.
  public static let codexRecentDays = 2
  /// Most sessions any one reader reports, or reads from an index.
  public static let maxSessions = 100
  /// Explicit evidence older than this does not keep a stale session alive.
  public static let activeEvidenceMs = 120_000.0
  /// The most of a local event log ever read: its tail.
  public static let tailBytes = 256 * 1024
  /// A session record bigger than this is not one; it is not read.
  public static let maxRecordBytes = 256 * 1024

  public static let claudeSessionsDir = [".claude", "sessions"]
  public static let claudeProjectsDir = [".claude", "projects"]
  public static let codexStateDatabase = [".codex", "state_5.sqlite"]
  public static let codexDesktopDatabase = [".codex", "sqlite", "codex-dev.db"]
  public static let codexSessionsDir = [".codex", "sessions"]
  public static let grokRegistry = [".grok", "active_sessions.json"]
  public static let grokSessionsDir = [".grok", "sessions"]
  public static let grokEventsFile = "events.jsonl"
  public static let grokSummaryFile = "summary.json"

  /// Codex's thread index, newest first.
  public static let codexRolloutsSQL =
    "SELECT id, title, rollout_path FROM threads WHERE archived = 0 ORDER BY updated_at_ms DESC LIMIT \(maxSessions)"
  /// The desktop app's catalogue, for when there is no rollout at all.
  public static let codexDesktopSQL =
    "SELECT source_updated_at, display_title FROM local_thread_catalog ORDER BY source_updated_at DESC LIMIT 1"
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
  /// How often the logs are re-read. Unchanged files cost a stat each.
  public static let scanIntervalMs = 60_000.0
  /// Longest line worth parsing; anything bigger is a blob, not a row.
  public static let maxLineLength = 1_048_576
  public static let claudeLogsDir = [".claude", "projects"]
  public static let codexLogsDir = [".codex", "sessions"]
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
  public static let statusUnknown = "Status unconfirmed"
}

/// Tokens one provider's agents got through, from the logs they keep locally.
public struct TokenUsage: Sendable, Codable, Equatable {
  public var providerId: ProviderId
  public var todayTokens: Double
  public var monthTokens: Double
  public var scannedAt: String

  public init(providerId: ProviderId, todayTokens: Double, monthTokens: Double, scannedAt: String) {
    self.providerId = providerId
    self.todayTokens = todayTokens
    self.monthTokens = monthTokens
    self.scannedAt = scannedAt
  }
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
  /// A provider that answered "not signed in" is asked again this often, not
  /// every poll: a dead token re-sent each minute — and, for Codex, a refresh
  /// posted with it — looks like abuse. Clicking its meter asks at once.
  public static let signedOutRetryMs = 300_000.0
  /// Waking, unlocking and the network returning often arrive together; they
  /// make one read between them, not three.
  public static let comeBackGapMs = 60_000.0
  /// The quickest a click on the same meter reads its provider again.
  public static let manualRefreshGapMs = 15_000.0
}

/// How the shell runs the local tools it asks for a token.
public enum CommandTuning {
  /// Long enough for `gh` to wake up, short enough that a hung tool cannot
  /// stall a poll.
  public static let timeoutSeconds = 8.0
  /// A menu-bar app launched from Finder inherits a bare PATH, so the places
  /// Homebrew and the CLIs' own installers put things are added explicitly.
  public static let extraPathDirectories = ["/opt/homebrew/bin", "/usr/local/bin", "~/.local/bin"]
}
