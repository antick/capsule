import CapsuleActivity
import CapsuleCore
import CapsuleUsage
import Foundation

/// Something the shell can undo: a timer, an observer, a watch.
public struct Subscription {
  private let body: @MainActor () -> Void

  public init(_ cancel: @escaping @MainActor () -> Void) {
    body = cancel
  }

  @MainActor public func cancel() { body() }
}

public typealias ShellAction = @MainActor @Sendable () -> Void

/// Where the shell's prompts come from. The Mac's are ``mac``; tests pass
/// their own and fire them by hand.
public struct ShellEvents {
  /// Every `seconds`, until cancelled.
  public var every: @MainActor (_ seconds: TimeInterval, _ action: @escaping ShellAction) -> Subscription
  /// The Mac woke from sleep.
  public var onWake: @MainActor (_ action: @escaping ShellAction) -> Subscription
  /// The screen unlocked.
  public var onUnlock: @MainActor (_ action: @escaping ShellAction) -> Subscription
  /// The network came back after being unreachable.
  public var onOnline: @MainActor (_ action: @escaping ShellAction) -> Subscription
  /// Something in `dir` changed. Nil when it cannot be watched.
  public var watch: @MainActor (_ dir: String, _ action: @escaping ShellAction) -> Subscription?

  public init(
    every: @escaping @MainActor (TimeInterval, @escaping ShellAction) -> Subscription,
    onWake: @escaping @MainActor (@escaping ShellAction) -> Subscription,
    onUnlock: @escaping @MainActor (@escaping ShellAction) -> Subscription,
    onOnline: @escaping @MainActor (@escaping ShellAction) -> Subscription,
    watch: @escaping @MainActor (String, @escaping ShellAction) -> Subscription?
  ) {
    self.every = every
    self.onWake = onWake
    self.onUnlock = onUnlock
    self.onOnline = onOnline
    self.watch = watch
  }
}

/// The usage poller as the schedule drives it.
public protocol UsageDriving: Sendable {
  func start() async
  func tick() async
  func resume() async
  func online() async
}

extension UsagePoller: UsageDriving {}

/// A reader the schedule re-runs: the activity monitor, the token scanner.
public protocol Rescanning: Sendable {
  func rescan() async
}

extension ActivityMonitor: Rescanning {}
extension TokenScanner: Rescanning {}

/// Turns the Mac's timers and notifications into calls on the logic modules,
/// as the Electron main process does with `setInterval` and `powerMonitor`.
///
/// - The poller ticks on the settings' interval, and refreshes on wake, on
///   screen unlock (the original's "online") and when the network returns.
/// - The activity monitor rescans on its own short poll and whenever the
///   Claude sessions directory changes; the poll is what notices a process
///   that died without touching a file.
/// - The token scanner rescans on its own long interval.
@MainActor
public final class ShellSchedule {
  private let usage: UsageDriving
  private let activity: Rescanning
  private let tokens: Rescanning
  private let events: ShellEvents
  private let watchedDirectory: String
  private var pollSubscription: Subscription?
  private var subscriptions: [Subscription] = []

  public init(
    usage: UsageDriving, activity: Rescanning, tokens: Rescanning,
    events: ShellEvents, watchedDirectory: String
  ) {
    self.usage = usage
    self.activity = activity
    self.tokens = tokens
    self.events = events
    self.watchedDirectory = watchedDirectory
  }

  /// Starts everything and reads once straight away.
  public func start(pollIntervalMs: Int) {
    stop()
    let usage = usage
    let activity = activity
    let tokens = tokens
    setPollInterval(pollIntervalMs)
    subscriptions = [
      events.onWake { Task { await usage.resume() } },
      events.onUnlock { Task { await usage.online() } },
      events.onOnline { Task { await usage.online() } },
      events.every(ActivityTuning.pollMs / 1000) { Task { await activity.rescan() } },
      events.every(TokenTuning.scanIntervalMs / 1000) { Task { await tokens.rescan() } },
    ]
    if let watch = events.watch(watchedDirectory, { Task { await activity.rescan() } }) {
      subscriptions.append(watch)
    }
    Task { await usage.start() }
    Task { await activity.rescan() }
    Task { await tokens.rescan() }
  }

  /// Re-times the poller's tick without re-reading anything.
  public func setPollInterval(_ ms: Int) {
    pollSubscription?.cancel()
    let usage = usage
    pollSubscription = events.every(Double(ms) / 1000) { Task { await usage.tick() } }
  }

  public func stop() {
    pollSubscription?.cancel()
    pollSubscription = nil
    for subscription in subscriptions { subscription.cancel() }
    subscriptions = []
  }
}
