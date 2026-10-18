import CapsuleCore
import ServiceManagement

/// Launch at login, through the system's login-item service.
enum LoginItem {
  static var enabled: Bool { SMAppService.mainApp.status == .enabled }

  /// Registers or unregisters the app. Fails for a copy macOS will not let
  /// launch itself, such as an unsigned build outside Applications; the
  /// failure is logged and the setting stays as asked.
  static func set(_ on: Bool) {
    guard on != enabled else { return }
    do {
      if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
    } catch {
      ShellLog.app.error("login item: \(error.localizedDescription, privacy: .public)")
    }
  }
}
