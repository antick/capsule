import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import SwiftUI

/// The menu-bar item: Capsule's mark or the chosen figures. A click opens
/// the panel of cards, a right-click the commands. Not there at all when
/// Capsule lives in the edge dock alone.
@MainActor
final class StatusItemController: NSObject {
  private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  private let popover = NSPopover()
  private let hosting = NSHostingController(rootView: AnyView(EmptyView()))
  /// The floating window's own copy: a view controller lives in one window.
  private let floatingHosting = NSHostingController(rootView: AnyView(EmptyView()))
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
    item.isVisible = settings.presence.showsMenuBarItem
    draw([])
  }

  func apply(_ next: CapsuleSettings) {
    settings = next
    item.isVisible = next.presence.showsMenuBarItem
    if !next.presence.showsMenuBarItem {
      if popover.isShown { popover.performClose(nil) }
      floating?.orderOut(nil)
    }
  }

  /// New readings: redraw the item if what it shows changed, and the panel.
  func update(_ content: UsagePanelContent) {
    self.content = content
    draw(menuBarEntries(settings, content.snapshots))
    if popover.isShown { hosting.rootView = AnyView(UsagePanelView(content: content)) }
    if floating?.isVisible == true { floatingHosting.rootView = AnyView(UsagePanelView(content: content)) }
  }

  private func draw(_ entries: [MenuBarEntry]) {
    guard entries != drawn || settings.pinStyle != drawnStyle, let button = item.button else { return }
    drawn = entries
    drawnStyle = settings.pinStyle
    button.image = entries.isEmpty ? BrandIcon.image(template: true) : MenuBarImage.render(entries, style: settings.pinStyle)
    let spoken = entries.map { entry in
      ([ProviderLabels.label(entry.provider)]
        + entry.values.compactMap { $0.percent.map { "\(jsString(.number($0)))\(Copy.percentSuffix)" } })
        .joined(separator: " ")
    }
    button.setAccessibilityLabel(([AppIdentity.name] + spoken).joined(separator: ", "))
  }

  @objc private func clicked() {
    let right = NSApp.currentEvent?.type == .rightMouseUp
      || NSApp.currentEvent?.modifierFlags.contains(.control) == true
    if right { return showCommands() }
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
    if let floating, floating.isVisible { return floating.orderOut(nil) }
    guard let content else { return }
    hosting.rootView = AnyView(UsagePanelView(content: content))
    if isOnScreen(button) {
      popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
      popover.contentViewController?.view.window?.makeKey()
    } else {
      showFloating()
    }
    onPanelOpened()
  }

  /// A menu-bar manager can park the item off every screen, where a popover
  /// anchored to it would open out of sight.
  private func isOnScreen(_ button: NSStatusBarButton) -> Bool {
    guard let window = button.window else { return false }
    let frame = window.convertToScreen(button.convert(button.bounds, to: nil))
    return NSScreen.screens.contains { $0.frame.intersects(frame) }
  }

  /// The panel as a small floating window under the menu bar's right end,
  /// for when the item itself cannot be seen. Closes when clicked away from.
  private var floating: NSPanel?

  private func showFloating() {
    let panel =
      floating
      ?? {
        let made = NSPanel(
          contentRect: .zero, styleMask: [.nonactivatingPanel, .titled, .fullSizeContentView], backing: .buffered,
          defer: false)
        made.titleVisibility = .hidden
        made.titlebarAppearsTransparent = true
        made.isFloatingPanel = true
        made.hidesOnDeactivate = false
        made.level = .popUpMenu
        made.isReleasedWhenClosed = false
        made.contentViewController = floatingHosting
        return made
      }()
    floating = panel
    floatingHosting.rootView = hosting.rootView
    guard let screen = NSScreen.main else { return }
    let size = floatingHosting.view.fittingSize
    let visible = screen.visibleFrame
    panel.setFrame(
      NSRect(
        x: visible.maxX - size.width - MenuBarPanelMetrics.padding, y: visible.maxY - size.height,
        width: size.width, height: size.height),
      display: true)
    panel.orderFrontRegardless()
    panel.makeKey()
    watchClickAway()
  }

  private var clickAway: Any?

  /// A click anywhere else puts the floating panel away, as a popover would.
  private func watchClickAway() {
    if let clickAway { NSEvent.removeMonitor(clickAway) }
    clickAway = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
      MainActor.assumeIsolated {
        self?.floating?.orderOut(nil)
        if let monitor = self?.clickAway { NSEvent.removeMonitor(monitor) }
        self?.clickAway = nil
      }
    }
  }
}
