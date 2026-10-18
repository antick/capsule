import AppKit
import CapsuleCore

/// Keeps the dock's panel where the placement engine says, drawn for the
/// current readings, and moves it when the displays or the appearance change.
@MainActor
public final class DockController {
  public let panel = DockPanel()
  private let view = DockView()
  private var settings: CapsuleSettings
  private var meterCount: Int
  private var observers: [NSObjectProtocol] = []

  public init(settings: CapsuleSettings) {
    self.settings = settings
    meterCount = settings.enabledProviderIds.count
    panel.contentView = view
  }

  public func show() {
    let center = NotificationCenter.default
    observers = [
      center.addObserver(
        forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
      ) { [weak self] _ in MainActor.assumeIsolated { self?.layout() } },
      NSWorkspace.shared.notificationCenter.addObserver(
        forName: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification, object: nil, queue: .main
      ) { [weak self] _ in MainActor.assumeIsolated { self?.layout() } },
      DistributedNotificationCenter.default().addObserver(
        forName: Notification.Name(ShellTuning.appearanceChangedNotification), object: nil, queue: .main
      ) { [weak self] _ in MainActor.assumeIsolated { self?.layout() } },
    ]
    layout()
    panel.orderFrontRegardless()
  }

  /// One meter per provider shown; the rail grows or shrinks with them.
  public func update(_ state: ShellState) {
    let count = state.snapshots.count
    guard count != meterCount, count > 0 else { return }
    meterCount = count
    layout()
  }

  public func hide() {
    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
      NSWorkspace.shared.notificationCenter.removeObserver(observer)
      DistributedNotificationCenter.default().removeObserver(observer)
    }
    observers = []
    panel.orderOut(nil)
  }

  /// The primary display carries the dock, as it does in the Electron app
  /// until the dock has been dragged elsewhere; remembering that display
  /// arrives with dragging (task 3.7).
  private func layout() {
    guard let screen = NSScreen.screens.first else { return }
    let chrome = chromeSnapshot(
      id: Int(screen.displayID), frame: screen.frame, visibleFrame: screen.visibleFrame,
      primaryHeight: screen.frame.height,
      dock: macDockPreferences(UserDefaults(suiteName: MacDockDefaults.domain))
    )
    let frame = dockFrame(
      settings: settings, meterCount: meterCount, chrome: chrome, primaryHeight: screen.frame.height
    )
    panel.setFrame(frame.window, display: false)
    view.frame = NSRect(origin: .zero, size: frame.window.size)
    let dark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
    view.show(
      rail: frame.rail, style: frame.style,
      theme: resolveHudTheme(settings.hudTheme, system: dark ? .dark : .light),
      reduceTransparency: NSWorkspace.shared.accessibilityDisplayShouldReduceTransparency
    )
  }
}

extension NSScreen {
  var displayID: UInt32 {
    (deviceDescription[NSDeviceDescriptionKey(ShellTuning.screenNumberKey)] as? NSNumber)?.uint32Value ?? 0
  }
}
