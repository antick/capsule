import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import SwiftUI

/// The menu-bar item: Capsule's mark, one percentage or the pinned metrics;
/// a click opens the panel of cards when Capsule lives in the menu bar, and
/// the commands otherwise. A right-click always opens the commands.
@MainActor
final class StatusItemController: NSObject {
  private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  private let popover = NSPopover()
  private let hosting = NSHostingController(rootView: AnyView(EmptyView()))
  private var settings: CapsuleSettings
  private var content: UsagePanelContent?
  private var drawn: [MenuBarEntry]?
  private var drawnStyle: PinStyle?

  /// The commands, built fresh each time.
  var commands: () -> NSMenu = { NSMenu() }
  /// The panel opened; the readings could be refreshed.
  var onPanelOpened: () -> Void = {}

  init(settings: CapsuleSettings) {
    self.settings = settings
    super.init()
    popover.behavior = .transient
    popover.animates = true
    hosting.sizingOptions = [.preferredContentSize]
    popover.contentViewController = hosting
    if let button = item.button {
      button.target = self
      button.action = #selector(clicked)
      button.sendAction(on: [.leftMouseUp, .rightMouseUp])
      button.setAccessibilityLabel(AppIdentity.name)
      button.toolTip = AppIdentity.name
    }
    draw([])
  }

  func apply(_ next: CapsuleSettings) {
    settings = next
    if !next.presence.opensPanelFromMenuBar, popover.isShown { popover.performClose(nil) }
  }

  /// New readings: redraw the item if what it shows changed, and the panel.
  func update(_ content: UsagePanelContent) {
    self.content = content
    draw(menuBarEntries(settings, content.snapshots))
    if popover.isShown { hosting.rootView = AnyView(UsagePanelView(content: content)) }
  }

  private func draw(_ entries: [MenuBarEntry]) {
    guard entries != drawn || settings.pinStyle != drawnStyle, let button = item.button else { return }
    drawn = entries
    drawnStyle = settings.pinStyle
    button.image = entries.isEmpty ? BrandIcon.image(template: true) : MenuBarImage.render(entries, style: settings.pinStyle)
    let spoken = entries.compactMap { entry in
      entry.percent.map { "\(ProviderLabels.label(entry.provider)) \(jsString(.number($0)))\(Copy.percentSuffix)" }
    }
    button.setAccessibilityLabel(([AppIdentity.name] + spoken).joined(separator: ", "))
  }

  @objc private func clicked() {
    let right = NSApp.currentEvent?.type == .rightMouseUp
      || NSApp.currentEvent?.modifierFlags.contains(.control) == true
    if right || !settings.presence.opensPanelFromMenuBar { return showCommands() }
    togglePanel()
  }

  /// The commands, attached to the item while open so they sit where a
  /// menu-bar menu does and assistive apps can reach them.
  private func showCommands() {
    guard let button = item.button else { return }
    if popover.isShown { popover.performClose(nil) }
    item.menu = commands()
    button.performClick(nil)
    item.menu = nil
  }

  func togglePanel() {
    guard let button = item.button else { return }
    if popover.isShown { return popover.performClose(nil) }
    guard let content else { return }
    hosting.rootView = AnyView(UsagePanelView(content: content))
    popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
    popover.contentViewController?.view.window?.makeKey()
    onPanelOpened()
  }
}
