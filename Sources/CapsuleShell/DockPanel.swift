import AppKit
import CapsuleCore

/// The dock's window: a non-activating floating panel that is on every Space,
/// stays put through Mission Control, is skipped by Cmd-` and stays out of
/// full-screen apps. It can never become key or main, so nothing about the
/// dock can take focus from the app being worked in (design decision 4).
public final class DockPanel: NSPanel {
  public init() {
    super.init(
      contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered, defer: false
    )
    isFloatingPanel = true
    hidesOnDeactivate = false
    level = .statusBar
    collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]
    isOpaque = false
    backgroundColor = .clear
    // The silhouette carries its own shadow; a window shadow would trace the
    // whole transparent frame.
    hasShadow = false
    isReleasedWhenClosed = false
    animationBehavior = .none
    // Click-through until the pointer reaches the dock itself; the
    // controller follows the pointer and takes the mouse only over the dock.
    ignoresMouseEvents = true
    // Moves reach the dock while it has the mouse, to set the cursor.
    acceptsMouseMovedEvents = true
  }

  public override var canBecomeKey: Bool { false }
  public override var canBecomeMain: Bool { false }
}
