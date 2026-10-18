import Foundation

/// A pending callback that can be called off.
@MainActor
public final class DockTimer {
  private var cancelled = false
  private let action: @MainActor () -> Void

  init(_ action: @escaping @MainActor () -> Void) { self.action = action }

  public func cancel() { cancelled = true }

  /// Runs the callback unless it was cancelled. For clocks to call.
  public func fire() {
    guard !cancelled else { return }
    cancelled = true
    action()
  }

  public var isPending: Bool { !cancelled }
}

/// Where the dock's delays come from. The main run loop in the app; a clock
/// the test advances by hand in the suite.
@MainActor
public protocol DockClock: AnyObject {
  /// Milliseconds on a monotonic clock.
  var nowMs: Double { get }
  func after(_ ms: Double, _ action: @escaping @MainActor () -> Void) -> DockTimer
}

/// The run loop's clock.
@MainActor
public final class MainClock: DockClock {
  public init() {}

  public var nowMs: Double { ProcessInfo.processInfo.systemUptime * 1000 }

  public func after(_ ms: Double, _ action: @escaping @MainActor () -> Void) -> DockTimer {
    let timer = DockTimer(action)
    DispatchQueue.main.asyncAfter(deadline: .now() + max(0, ms) / 1000) {
      MainActor.assumeIsolated { timer.fire() }
    }
    return timer
  }
}
