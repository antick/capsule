import AppKit
import CapsuleCore
import CapsuleSystem
import Foundation
import Network

extension ShellEvents {
  /// The real prompts: run-loop timers, workspace and distributed
  /// notifications, a network-path monitor and FSEvents.
  @MainActor public static var mac: ShellEvents {
    ShellEvents(
      every: { seconds, action in
        let timer = Timer(timeInterval: seconds, repeats: true) { _ in
          MainActor.assumeIsolated { action() }
        }
        timer.tolerance = seconds * ShellTuning.timerTolerance
        // Common modes, so a tick is not held back while a menu is open.
        RunLoop.main.add(timer, forMode: .common)
        return Subscription { timer.invalidate() }
      },
      onWake: { action in
        observe(NSWorkspace.shared.notificationCenter, NSWorkspace.didWakeNotification, action)
      },
      onUnlock: { action in
        observe(
          DistributedNotificationCenter.default(),
          Notification.Name(ShellTuning.screenUnlockedNotification), action
        )
      },
      onOnline: { action in
        let watch = NetworkWatch(onOnline: action)
        return Subscription { watch.stop() }
      },
      watch: { dir, action in
        let watcher = DirectoryWatcher(dir) {
          Task { @MainActor in action() }
        }
        return watcher.map { watcher in Subscription { watcher.stop() } }
      }
    )
  }
}

@MainActor
private func observe(
  _ center: NotificationCenter, _ name: Notification.Name, _ action: @escaping ShellAction
) -> Subscription {
  let token = center.addObserver(forName: name, object: nil, queue: .main) { _ in
    MainActor.assumeIsolated { action() }
  }
  return Subscription { center.removeObserver(token) }
}

/// Whether a path report means the network came back: usable now, and
/// known to have been unusable before. The first report has nothing before it.
func networkReturned(was: Bool?, now: Bool) -> Bool {
  now && was == false
}

/// Calls back when the network path becomes usable after being unusable.
/// The first report is the state at launch, not a return, so it is skipped.
final class NetworkWatch: @unchecked Sendable {
  private let monitor = NWPathMonitor()
  private let queue = DispatchQueue(label: "\(AppIdentity.bundleIdentifier).network")
  /// Touched only on `queue`.
  private var wasSatisfied: Bool?

  init(onOnline: @escaping ShellAction) {
    monitor.pathUpdateHandler = { [weak self] path in
      guard let self else { return }
      let satisfied = path.status == .satisfied
      defer { wasSatisfied = satisfied }
      guard networkReturned(was: wasSatisfied, now: satisfied) else { return }
      Task { @MainActor in onOnline() }
    }
    monitor.start(queue: queue)
  }

  func stop() { monitor.cancel() }
}
