import AppKit
import CapsuleShell

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  private var model: AppModel?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let model = AppModel()
    model.start()
    self.model = model
  }

  /// Opening the app again — from Finder or Spotlight — shows its settings,
  /// since it has no window of its own.
  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    model?.openSettings(.appearance)
    return false
  }

  func applicationWillTerminate(_ notification: Notification) {
    model?.stop()
  }
}
