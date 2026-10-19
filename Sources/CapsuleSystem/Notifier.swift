import CapsuleCore
import Foundation
@preconcurrency import UserNotifications

/// Posts Capsule's own macOS notifications. Asks for permission the first
/// time one is needed, never at launch.
public final class Notifier: @unchecked Sendable {
  public init() {}

  public func post(_ alerts: [QuotaAlert]) {
    guard !alerts.isEmpty else { return }
    let center = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
      guard granted else { return }
      for alert in alerts {
        let content = UNMutableNotificationContent()
        content.title = alert.title
        content.body = alert.body
        content.threadIdentifier = alert.meter.rawValue
        center.add(UNNotificationRequest(identifier: alert.id, content: content, trigger: nil))
      }
    }
  }
}
