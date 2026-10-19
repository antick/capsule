import AppKit
import CapsuleCore
import CapsuleHUD
import CapsuleSettingsUI

/// What the menus act on. The app implements it; the menus only read and ask.
@MainActor
public protocol MenuHandlers: AnyObject {
  var settings: CapsuleSettings { get }
  var keepOpen: Bool { get }
  var update: UpdateState { get }
  func revealDock()
  func toggleKeepOpen()
  func openSettings(_ page: SettingsPage)
  func applyPlacement(_ preset: PlacementPreset)
  func checkForUpdates()
  func installUpdate()
}


/// The menus: the commands the menu-bar item and the dock's right-click
/// show, and the application menu shown while settings is in front.
@MainActor
public final class Menus: NSObject, NSMenuDelegate {
  private weak var handlers: MenuHandlers?

  public init(handlers: MenuHandlers) {
    self.handlers = handlers
    super.init()
    NSApp.mainMenu = applicationMenu()
  }

  /// Rebuilt each time it opens, so it always says what is true now.
  public func menuNeedsUpdate(_ menu: NSMenu) {
    menu.removeAllItems()
    for entry in applicationItems() { menu.addItem(entry) }
  }

  /// A fresh copy of the commands, for the menu-bar item and the dock's
  /// right-click.
  public func contextMenu() -> NSMenu {
    let menu = NSMenu()
    for entry in commandItems() { menu.addItem(entry) }
    return menu
  }

  /// Show Dock, Keep open, Settings, Position, updates, Quit. The dock's
  /// own commands are left out while Capsule lives only in the menu bar.
  private func commandItems() -> [NSMenuItem] {
    guard let handlers else { return [] }
    guard handlers.settings.presence.showsDock else {
      return [
        action(Copy.openSettings) { $0.openSettings(.appearance) },
        updateItem(),
        .separator(),
        action(Copy.quit) { _ in NSApp.terminate(nil) },
      ]
    }
    let position = NSMenuItem(title: Copy.position, action: nil, keyEquivalent: "")
    position.submenu = placementMenu(handlers.settings.placementPreset)
    return [
      action(Copy.showDock) { $0.revealDock() },
      keepOpenItem(),
      action(Copy.openSettings) { $0.openSettings(.appearance) },
      .separator(),
      position,
      updateItem(),
      .separator(),
      action(Copy.quit) { _ in NSApp.terminate(nil) },
    ]
  }

  /// Checked while the dock is held out, but only changeable when the dock
  /// hides by itself; an always-shown dock is held out by a setting.
  private func keepOpenItem(key: String = "") -> NSMenuItem {
    let entry = action(Copy.keepOpen, key: key) { $0.toggleKeepOpen() }
    let autoHide = handlers?.settings.autoHide ?? false
    entry.state = handlers?.keepOpen == true ? .on : .off
    entry.isEnabled = autoHide
    entry.toolTip = autoHide ? nil : Copy.keepOpenDisabledHint
    return entry
  }

  /// One item that changes its job: the restart while a download waits,
  /// otherwise a check.
  private func updateItem() -> NSMenuItem {
    guard let handlers else { return .separator() }
    if handlers.update.phase == .ready {
      return action(UpdateCopy.menuReady) { $0.installUpdate() }
    }
    let entry = action(UpdateCopy.menuCheck) {
      $0.checkForUpdates()
      $0.openSettings(.updates)
    }
    entry.isEnabled = handlers.update.canCheck
    return entry
  }

  private func placementMenu(_ current: PlacementPreset) -> NSMenu {
    let menu = NSMenu()
    for preset in PlacementPreset.allCases {
      let entry = action(preset.label) { $0.applyPlacement(preset) }
      entry.state = preset == current ? .on : .off
      menu.addItem(entry)
    }
    return menu
  }

  /// The application menu, for while the settings window is in front.
  private func applicationMenu() -> NSMenu {
    let main = NSMenu()
    let app = NSMenu(title: AppIdentity.name)
    app.delegate = self
    // Filled now as well as on opening, so the shortcuts work before it has
    // ever been opened.
    for entry in applicationItems() { app.addItem(entry) }
    let appItem = NSMenuItem()
    appItem.submenu = app
    main.addItem(appItem)
    let edit = NSMenu(title: "Edit")
    for (title, selector, key) in [
      ("Undo", Selector(("undo:")), "z"), ("Redo", Selector(("redo:")), "Z"),
      ("Cut", #selector(NSText.cut(_:)), "x"), ("Copy", #selector(NSText.copy(_:)), "c"),
      ("Paste", #selector(NSText.paste(_:)), "v"), ("Select All", #selector(NSText.selectAll(_:)), "a"),
    ] {
      edit.addItem(NSMenuItem(title: title, action: selector, keyEquivalent: key))
    }
    let editItem = NSMenuItem()
    editItem.submenu = edit
    main.addItem(editItem)
    return main
  }

  /// The application menu's own items: About, the update, the dock's
  /// commands with their shortcuts, Hide and Quit.
  private func applicationItems() -> [NSMenuItem] {
    let show = action(Copy.showDock, key: "d") { $0.revealDock() }
    show.keyEquivalentModifierMask = [.command, .shift]
    let keep = keepOpenItem(key: "k")
    keep.keyEquivalentModifierMask = [.command, .shift]
    return [
      NSMenuItem(
        title: "About \(AppIdentity.name)",
        action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: ""),
      updateItem(),
      .separator(),
      show,
      keep,
      action(Copy.openSettings, key: ",") { $0.openSettings(.appearance) },
      .separator(),
      NSMenuItem(title: "Hide \(AppIdentity.name)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h"),
      .separator(),
      NSMenuItem(title: Copy.quit, action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"),
    ]
  }

  private func action(_ title: String, key: String = "", _ run: @escaping @MainActor (MenuHandlers) -> Void)
    -> NSMenuItem
  {
    let entry = ClosureMenuItem(title: title, keyEquivalent: key) { [weak self] in
      guard let handlers = self?.handlers else { return }
      run(handlers)
    }
    return entry
  }
}

/// A menu item that runs a closure.
@MainActor
final class ClosureMenuItem: NSMenuItem {
  private let run: @MainActor () -> Void

  init(title: String, keyEquivalent: String, run: @escaping @MainActor () -> Void) {
    self.run = run
    super.init(title: title, action: #selector(fire), keyEquivalent: keyEquivalent)
    target = self
  }

  @available(*, unavailable)
  required init(coder: NSCoder) { fatalError("built in code") }

  @objc private func fire() { run() }
}
