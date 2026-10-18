import AppKit
import CapsuleCore

/// The menu-bar item. Only Quit for now: the dock shows no window and has no
/// Dock tile, so without it the app could not be left. The rest of the menu —
/// Show Dock, Settings, Position, updates — arrives with task 3.9.
@MainActor
public final class StatusItem {
  private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

  public init() {
    if let button = item.button {
      let image = NSImage(systemSymbolName: ShellTuning.statusSymbol, accessibilityDescription: AppIdentity.name)
      image?.isTemplate = true
      button.image = image
      button.setAccessibilityLabel(AppIdentity.name)
    }
    let menu = NSMenu()
    menu.addItem(
      NSMenuItem(title: ShellCopy.quit, action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    )
    item.menu = menu
  }
}
