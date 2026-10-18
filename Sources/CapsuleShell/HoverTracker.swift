import AppKit

/// Reports every pointer move on screen, ours or another app's.
///
/// The dock's window lets clicks through wherever it draws nothing, and a
/// window that ignores the mouse hears nothing about it either; so the
/// pointer is followed from outside, and the dock decides from that whether
/// to take the mouse. Event monitors rather than the Electron app's cursor
/// poll: they cost nothing while the mouse is still.
@MainActor
final class HoverTracker {
  private let onMove: @MainActor (NSPoint) -> Void
  private var global: Any?
  private var local: Any?
  private static let events: NSEvent.EventTypeMask = [
    .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged,
  ]

  init(onMove: @escaping @MainActor (NSPoint) -> Void) {
    self.onMove = onMove
  }

  func start() {
    guard global == nil else { return }
    global = NSEvent.addGlobalMonitorForEvents(matching: Self.events) { [weak self] _ in
      MainActor.assumeIsolated { self?.onMove(NSEvent.mouseLocation) }
    }
    local = NSEvent.addLocalMonitorForEvents(matching: Self.events) { [weak self] event in
      MainActor.assumeIsolated { self?.onMove(NSEvent.mouseLocation) }
      return event
    }
  }

  func stop() {
    for monitor in [global, local].compactMap({ $0 }) { NSEvent.removeMonitor(monitor) }
    global = nil
    local = nil
  }
}
