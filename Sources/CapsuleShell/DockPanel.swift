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
    // Until hit testing against the live path lands (task 3.4) the dock lets
    // every click through, so its transparent frame never blocks the desktop.
    ignoresMouseEvents = true
  }

  public override var canBecomeKey: Bool { false }
  public override var canBecomeMain: Bool { false }
}

/// The dock's surface: the rail's outline as the mask of a vibrancy view,
/// with the theme's surface over it, and a hairline for outlined styles.
/// Falls back to the plain surface when Reduce Transparency is on.
public final class DockView: NSView {
  private let vibrancy = NSVisualEffectView()
  /// Holds the fill and the hairline. A view of its own, stacked above the
  /// vibrancy: layers added straight to an AppKit-managed layer get
  /// reordered beneath its subviews' layers.
  private let paint = ShapeHost()
  private let mask = CAShapeLayer()
  private let surface = CAShapeLayer()
  private let outline = CAShapeLayer()

  public override init(frame: NSRect) {
    super.init(frame: frame)
    wantsLayer = true
    vibrancy.material = .hudWindow
    vibrancy.blendingMode = .behindWindow
    vibrancy.state = .active
    vibrancy.wantsLayer = true
    vibrancy.layer?.mask = mask
    outline.fillColor = nil
    outline.lineWidth = ShellTuning.outlineWidth
    paint.layer?.addSublayer(surface)
    paint.layer?.addSublayer(outline)
    for view in [vibrancy, paint] as [NSView] {
      view.frame = bounds
      view.autoresizingMask = [.width, .height]
      addSubview(view)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("DockView is built in code") }

  /// Redraws for a new outline and palette. No implicit animation: motion
  /// arrives with the meters and the card (task 3.5).
  public func show(rail: CGPath, style: DockStyle, theme: HudTheme, reduceTransparency: Bool) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for shape in [mask, surface, outline] {
      shape.frame = bounds
      shape.path = rail
    }
    mask.fillColor = NSColor.black.cgColor
    vibrancy.isHidden = reduceTransparency
    vibrancy.appearance = NSAppearance(named: theme.appearance == .dark ? .darkAqua : .aqua)
    let opacity = reduceTransparency ? 1 : ShellTuning.surfaceOpacity
    surface.fillColor = cgColor(theme.surface, opacity: opacity)
    outline.strokeColor = cgColor(theme.surfaceEdge)
    outline.isHidden = !style.outline
    CATransaction.commit()
  }

  /// Whether a point in the view lands on the dock, for the hit test to come.
  public func contains(_ point: NSPoint) -> Bool {
    surface.path?.contains(point) ?? false
  }
}

/// A view that owns its layer outright, so AppKit leaves its sublayers be.
private final class ShapeHost: NSView {
  override init(frame: NSRect) {
    super.init(frame: frame)
    layer = CALayer()
    wantsLayer = true
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("ShapeHost is built in code") }
}

func cgColor(_ color: ThemeColor, opacity: Double = 1) -> CGColor {
  CGColor(
    srgbRed: color.red / 255, green: color.green / 255, blue: color.blue / 255,
    alpha: color.alpha * opacity
  )
}
