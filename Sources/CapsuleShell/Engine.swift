import CapsuleActivity
import CapsuleCore
import CapsuleSystem
import CapsuleUsage
import Foundation
import os

/// The shell's log. Readings and counts only: never a token, a path under
/// the user's home, or a session title.
public enum ShellLog {
  public static let engine = Logger(subsystem: AppIdentity.logSubsystem, category: "engine")
}

/// What the dock has to show, as of the last change.
/// Lets the modules' callbacks, made before the engine exists, reach it
/// once it does. Read and written only on the main actor.
private final class Owner: @unchecked Sendable {
  @MainActor weak var engine: Engine?
}

public struct ShellState: Sendable, Equatable {
  public var snapshots: [UsageSnapshot] = []
  public var activity: [ProviderId: [AgentSession]] = [:]
  public var tokens: [ProviderId: TokenUsage] = [:]

  public init() {}
}

/// The logic modules on the real hosts, scheduled by the Mac's own timers and
/// notifications. Replaces the Electron main process's `createUsageHost`,
/// `createActivityMonitor` and `createTokenScanner` wiring.
@MainActor
public final class Engine {
  public let settings: CapsuleSettings
  public private(set) var state = ShellState()
  /// Called on the main actor after every change the modules publish.
  public var onChange: ((ShellState) -> Void)?

  private let poller: UsagePoller
  private let monitor: ActivityMonitor
  private let scanner: TokenScanner
  private let schedule: ShellSchedule
  /// The modules publish from their own actors; each writes its part here and
  /// asks the main actor to look, so a late hop can never show an older value.
  private let latest = OSAllocatedUnfairLock(initialState: ShellState())
  private var lastLogged = ""

  public init(store: JSONStore, events: ShellEvents, settings: CapsuleSettings) {
    self.settings = settings
    let enabled: @Sendable () -> [ProviderId] = { settings.enabledProviderIds }
    let latest = latest
    let busy = OSAllocatedUnfairLock(initialState: false)
    let owner = Owner()
    let refresh: @Sendable () -> Void = { Task { @MainActor in owner.engine?.publish() } }

    let activityHost = MacActivityHost(store: store)
    monitor = ActivityMonitor(host: activityHost, enabled: enabled) { activity in
      busy.withLock { $0 = anyAgentActive(activity) }
      latest.withLock { $0.activity = activity }
      refresh()
    }
    scanner = TokenScanner(host: activityHost, enabled: enabled) { tokens in
      latest.withLock { $0.tokens = tokens }
      refresh()
    }
    poller = UsagePoller(
      providers: Engine.providers,
      host: MacPollerHost(store: store),
      settings: { settings },
      onChange: { snapshots in
        latest.withLock { $0.snapshots = snapshots }
        refresh()
      },
      isBusy: { busy.withLock { $0 } }
    )
    let monitor = monitor
    schedule = ShellSchedule(
      usage: poller, activity: monitor, tokens: scanner, events: events,
      watchedDirectory: monitor.watchedDirectory
    )
    owner.engine = self
  }

  /// Every provider the app can read, in the dock's order. Settings decide
  /// which of them are asked.
  static let providers: [UsageProvider] = [
    ClaudeUsageProvider(), CodexUsageProvider(), GrokUsageProvider(),
    CursorUsageProvider(), CopilotUsageProvider(),
  ]

  public func start() { schedule.start(pollIntervalMs: settings.pollIntervalMs) }
  public func stop() { schedule.stop() }

  private func publish() {
    let next = latest.withLock { $0 }
    guard next != state else { return }
    state = next
    logReadings()
    onChange?(state)
  }

  /// One line per change of what the dock would say, as the Electron main
  /// process logs at launch: `claude:ok:42 codex:unauthenticated:—`.
  private func logReadings() {
    let line = state.snapshots
      .map { "\($0.providerId.rawValue):\($0.status.rawValue):\($0.primaryPercent.map { jsString(.number($0)) } ?? "—")" }
      .joined(separator: " ")
    let sessions = state.activity.map { "\($0.key.rawValue)=\($0.value.count)" }.sorted().joined(separator: " ")
    let summary = "usage \(line) · sessions \(sessions.isEmpty ? "none" : sessions)"
    guard summary != lastLogged else { return }
    lastLogged = summary
    ShellLog.engine.notice("\(summary, privacy: .public)")
  }

  /// The native app's own schema v7 settings, or the defaults. Settings
  /// carried over from the Electron app arrive with the cutover (task 4.6).
  public static func loadSettings(_ store: JSONStore) -> CapsuleSettings {
    let path = store.directory.appendingPathComponent(AppIdentity.settingsFile).path
    guard let raw = readTextFile(path).flatMap(JSONValue.parse),
      let settings = CapsuleSettings.read(raw)
    else { return .defaults }
    return settings
  }
}
