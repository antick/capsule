import CapsuleCore
import Foundation

/// Watches every agent tool it knows how to read and publishes what they are
/// doing. The shell calls ``rescan()`` on its poll interval and whenever the
/// Claude sessions directory changes; the poll is what notices a process that
/// died without touching any file.
public actor ActivityMonitor {
  private let host: ActivityHost
  private let enabled: @Sendable () -> [ProviderId]
  private let onChange: @Sendable ([ProviderId: [AgentSession]]) -> Void
  public private(set) var activity: [ProviderId: [AgentSession]] = [:]
  private var inFlight: Task<Void, Never>?

  public init(
    host: ActivityHost, enabled: @escaping @Sendable () -> [ProviderId],
    onChange: @escaping @Sendable ([ProviderId: [AgentSession]]) -> Void
  ) {
    self.host = host
    self.enabled = enabled
    self.onChange = onChange
  }

  /// The directory whose changes should prompt a rescan.
  public nonisolated var watchedDirectory: String {
    joinPath(host.homeDir, ActivityTuning.claudeSessionsDir)
  }

  /// Cursor and Copilot leave no session record that can be read honestly, so
  /// they report nothing rather than guess from the process table.
  private func read(_ id: ProviderId) async -> [AgentSession] {
    switch id {
    case .claude: return await readClaudeSessions(host)
    case .codex: return await readCodexSessions(host)
    case .grok: return await readGrokSessions(host)
    case .cursor, .copilot: return []
    }
  }

  /// Reads every enabled provider. A rescan already running is the answer to a
  /// second request for one.
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
    var next: [ProviderId: [AgentSession]] = [:]
    for id in ProviderId.allCases where wanted.contains(id) {
      let sessions = await read(id)
      if !sessions.isEmpty { next[id] = sessions }
    }
    // Only churn the dock for a change it can see.
    guard next != activity else { return }
    activity = next
    onChange(activity)
  }

  /// Whether any agent, for any provider, is doing something.
  public var isBusy: Bool { anyAgentActive(activity) }
}
