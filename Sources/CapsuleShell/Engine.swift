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
  public static let app = Logger(subsystem: AppIdentity.logSubsystem, category: "app")
}

/// What the dock has to show, as of the last change.
public struct ShellState: Sendable, Equatable {
  public var snapshots: [UsageSnapshot] = []
  public var activity: [ProviderId: [AgentSession]] = [:]
  public var tokens: [ProviderId: TokenUsage] = [:]
  public var notices: [ActivityNotice] = []

  public init() {}
}

/// Lets the modules' callbacks, made before the engine exists, reach it
/// once it does. Read and written only on the main actor.
private final class Owner: @unchecked Sendable {
  @MainActor weak var engine: Engine?
}

/// The logic modules on the real hosts, scheduled by the Mac's own timers and
/// notifications. Replaces the Electron main process's `createUsageHost`,
/// `createActivityMonitor`, `createTokenScanner` and notice wiring.
@MainActor
public final class Engine {
  public private(set) var settings: CapsuleSettings
  public private(set) var state = ShellState()
  /// Called on the main actor after every change the modules publish.
  public var onChange: ((ShellState) -> Void)?
  /// Called once, after the first round of reads has landed.
  public var onFirstReading: ((ShellState) -> Void)?

  private let store: JSONStore
  private let events: ShellEvents
  private let current: OSAllocatedUnfairLock<CapsuleSettings>
  private let busy = OSAllocatedUnfairLock(initialState: false)
  /// The modules publish from their own actors; each writes its part here and
  /// asks the main actor to look, so a late hop can never show an older value.
  private let latest = OSAllocatedUnfairLock(initialState: ShellState())
  private let owner = Owner()
  private let activityHost: MacActivityHost
  private var poller: UsagePoller
  private let monitor: ActivityMonitor
  private let scanner: TokenScanner
  private var schedule: ShellSchedule
  private let tracker = NoticeTracker()
  private var lastLogged = ""
  private var started = false

  public init(store: JSONStore, events: ShellEvents, settings: CapsuleSettings) {
    self.store = store
    self.events = events
    self.settings = settings
    current = OSAllocatedUnfairLock(initialState: settings)
    let current = current
    let enabled: @Sendable () -> [ProviderId] = { current.withLock { $0.enabledProviderIds } }
    let latest = latest
    let busy = busy
    let owner = owner
    let publish: @Sendable () -> Void = { Task { @MainActor in owner.engine?.publish() } }

    activityHost = MacActivityHost(store: store)
    monitor = ActivityMonitor(host: activityHost, enabled: enabled) { activity in
      busy.withLock { $0 = anyAgentActive(activity) }
      latest.withLock { $0.activity = activity }
      Task { @MainActor in owner.engine?.activityChanged(activity) }
    }
    scanner = TokenScanner(host: activityHost, enabled: enabled) { tokens in
      latest.withLock { $0.tokens = tokens }
      publish()
    }
    poller = Engine.makePoller(settings: settings, store: store, current: current, latest: latest, busy: busy, publish: publish)
    schedule = ShellSchedule(
      usage: poller, activity: monitor, tokens: scanner, events: events,
      watchedDirectory: monitor.watchedDirectory
    )
    owner.engine = self
  }

  /// Every provider the app can read, in the dock's order, or the samples.
  static func providers(demo: Bool) -> [UsageProvider] {
    demo
      ? SettingsDefaults.enabledProviderIds.map { DemoUsageProvider($0) }
      : [
        ClaudeUsageProvider(), CodexUsageProvider(), GrokUsageProvider(), CursorUsageProvider(),
      ]
  }

  private static func makePoller(
    settings: CapsuleSettings, store: JSONStore, current: OSAllocatedUnfairLock<CapsuleSettings>,
    latest: OSAllocatedUnfairLock<ShellState>, busy: OSAllocatedUnfairLock<Bool>,
    publish: @escaping @Sendable () -> Void
  ) -> UsagePoller {
    UsagePoller(
      providers: providers(demo: settings.demoMode),
      host: MacPollerHost(store: store),
      settings: { current.withLock { $0 } },
      onChange: { snapshots in
        latest.withLock { $0.snapshots = snapshots }
        publish()
      },
      isBusy: { busy.withLock { $0 } }
    )
  }

  public func start() {
    let owner = owner
    schedule.start(pollIntervalMs: settings.pollIntervalMs) {
      // The first round of reads, so the app can tell who is not signed in.
      guard let engine = owner.engine, !engine.started else { return }
      engine.started = true
      engine.publish()
      engine.onFirstReading?(engine.state)
    }
  }

  public func stop() { schedule.stop() }

  /// Takes new settings, doing only what each change needs: new providers
  /// for demo mode, a new tick for the interval, and otherwise reconciling
  /// the provider list at once before reading again.
  public func apply(_ next: CapsuleSettings) {
    let previous = settings
    settings = next
    current.withLock { $0 = next }
    if next.demoMode != previous.demoMode {
      schedule.stop()
      let owner = owner
      poller = Engine.makePoller(
        settings: next, store: store, current: current, latest: latest, busy: busy,
        publish: { Task { @MainActor in owner.engine?.publish() } }
      )
      schedule = ShellSchedule(
        usage: poller, activity: monitor, tokens: scanner, events: events,
        watchedDirectory: monitor.watchedDirectory
      )
      schedule.start(pollIntervalMs: next.pollIntervalMs)
      return
    }
    if next.pollIntervalMs != previous.pollIntervalMs {
      schedule.setPollInterval(next.pollIntervalMs)
    }
    // Only a change to which providers are shown needs the network. A theme,
    // a size step or a drag is not a reason to ask every provider again.
    guard next.enabledProviderIds != previous.enabledProviderIds else { return }
    let poller = poller
    let monitor = monitor
    let scanner = scanner
    Task {
      await poller.sync()
      await poller.refresh()
    }
    Task { await monitor.rescan() }
    Task { await scanner.rescan() }
  }

  /// The user asked for one provider to be read again. Clicks on the same
  /// meter read it at most once per gap, however fast they come.
  public func refreshProvider(_ id: ProviderId) {
    let now = clock()
    if let last = lastAsked[id], now - last < PollerTuning.manualRefreshGapMs { return }
    lastAsked[id] = now
    let poller = poller
    Task { await poller.refreshProvider(id) }
  }

  private var lastAsked: [ProviderId: Double] = [:]
  /// Milliseconds on a monotonic clock; replaceable for tests.
  var clock: () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 }

  // MARK: Notices

  private func activityChanged(_ activity: [ProviderId: [AgentSession]]) {
    let notices = tracker.update(activity, now: Date())
    latest.withLock { $0.notices = notices }
    publish()
  }

  public func markRead(_ ids: [String]) {
    let notices = tracker.markRead(ids)
    latest.withLock { $0.notices = notices }
    publish()
  }

  public func dismiss(_ id: String) {
    let notices = tracker.dismiss(id)
    latest.withLock { $0.notices = notices }
    publish()
  }

  public func dismissAll() {
    for notice in tracker.notices { tracker.dismiss(notice.id) }
    latest.withLock { $0.notices = [] }
    publish()
  }

  // MARK: Publishing

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
    let summary = "usage \(line) · sessions \(sessions.isEmpty ? "none" : sessions) · notices \(state.notices.count)"
    guard summary != lastLogged else { return }
    lastLogged = summary
    ShellLog.engine.notice("\(summary, privacy: .public)")
  }

  /// The native app's own schema v7 settings, or the defaults. Settings
  /// carried over from the Electron app arrive with the cutover (task 4.6).
  public nonisolated static func loadSettings(_ store: JSONStore) -> CapsuleSettings {
    let url = store.directory.appendingPathComponent(AppIdentity.settingsFile)
    guard let data = FileManager.default.contents(atPath: url.path), let settings = CapsuleSettings.read(data: data)
    else { return .defaults }
    return settings
  }

  /// Writes settings down, atomically, in the shape they are read back in.
  public nonisolated static func saveSettings(_ settings: CapsuleSettings, to store: JSONStore) {
    guard let data = settings.documentData else { return }
    try? FileManager.default.createDirectory(at: store.directory, withIntermediateDirectories: true)
    try? data.write(to: store.directory.appendingPathComponent(AppIdentity.settingsFile), options: .atomic)
  }
}
