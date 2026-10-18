import AppKit
import CapsuleCore
import CapsuleShell
import CapsuleSystem

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  private var engine: Engine?
  private var dock: DockController?
  private var status: StatusItem?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let store = JSONStore.applicationSupport(AppIdentity.supportDirectory)
    let settings = Engine.loadSettings(store)
    let engine = Engine(store: store, events: .mac, settings: settings)
    let dock = DockController(settings: settings)
    engine.onChange = { [weak dock] state in dock?.update(state) }
    status = StatusItem()
    dock.show()
    engine.start()
    self.engine = engine
    self.dock = dock
  }

  func applicationWillTerminate(_ notification: Notification) {
    engine?.stop()
    dock?.hide()
  }
}
