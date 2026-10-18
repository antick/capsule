import AppKit
import CapsuleCore
import CapsuleHUD

extension ThemeColor {
  public var cgColor: CGColor {
    CGColor(srgbRed: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
  }

  public var nsColor: NSColor {
    NSColor(srgbRed: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
  }

  public func with(alpha: Double) -> ThemeColor {
    ThemeColor(red, green, blue, alpha)
  }
}

/// Whether motion should be cut short, as the system asks.
@MainActor
var reduceMotion: Bool {
  reduceMotionOverride ?? NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
}

/// Stands in for the system setting, so tests can run with Reduce Motion on.
@MainActor
var reduceMotionOverride: Bool?

/// A spring as Core Animation runs it, at unit mass.
@MainActor
func springAnimation(_ keyPath: String, _ spring: Spring, from: Any?, to: Any?) -> CAAnimation {
  let animation = CASpringAnimation(keyPath: keyPath)
  animation.mass = 1
  animation.stiffness = spring.stiffness
  animation.damping = spring.friction
  animation.fromValue = from
  animation.toValue = to
  animation.duration = reduceMotion ? 0 : animation.settlingDuration
  return animation
}

/// A turn that never stops, for the sweep and the working arc.
@MainActor
func spin(_ ms: Double) -> CAAnimation {
  let animation = CABasicAnimation(keyPath: "transform.rotation.z")
  animation.fromValue = 0
  animation.toValue = 2 * Double.pi
  animation.duration = ms / 1000
  animation.repeatCount = .infinity
  return animation
}

/// A breath that never stops, for anything waiting on you.
@MainActor
func pulse() -> CAAnimation {
  let animation = CABasicAnimation(keyPath: "opacity")
  animation.fromValue = 1
  animation.toValue = Motion.activityPulseFloor
  animation.duration = Motion.activityPulseMs / 1000
  animation.autoreverses = true
  animation.repeatCount = .infinity
  animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
  return animation
}

/// A circle starting at twelve o'clock and running clockwise, in a y-down
/// box of `size`, so `strokeEnd` fills it the way a meter reads.
func ringPath(size: Double, radius: Double) -> CGPath {
  let path = CGMutablePath()
  let center = CGPoint(x: size / 2, y: size / 2)
  path.addArc(
    center: center, radius: radius, startAngle: -.pi / 2, endAngle: 1.5 * .pi, clockwise: false
  )
  return path
}

/// A provider's mark as shape layers, filled in `color`, `size` points square.
@MainActor
func iconLayer(_ id: ProviderId, size: Double, color: ThemeColor) -> CALayer {
  let host = CALayer()
  host.bounds = CGRect(x: 0, y: 0, width: size, height: size)
  host.isGeometryFlipped = false
  var scale = CGAffineTransform(scaleX: size / ProviderIcons.artboard, y: size / ProviderIcons.artboard)
  for shape in ProviderIcons.shapes(id) {
    let layer = CAShapeLayer()
    layer.frame = host.bounds
    layer.path = shape.path.copy(using: &scale)
    layer.fillColor = color.cgColor
    layer.opacity = Float(shape.opacity)
    layer.fillRule = shape.evenOdd ? .evenOdd : .nonZero
    host.addSublayer(layer)
  }
  return host
}

/// An `NSView` with top-left origin, the dock's own coordinates.
open class FlippedView: NSView {
  public override var isFlipped: Bool { true }

  public override init(frame: NSRect) {
    super.init(frame: frame)
    wantsLayer = true
  }

  @available(*, unavailable)
  public required init?(coder: NSCoder) { fatalError("built in code") }
}

/// A label for the dock: system type, no editing, no background.
@MainActor
func dockLabel(size: Double, weight: NSFont.Weight = .regular, color: ThemeColor) -> NSTextField {
  let label = NSTextField(labelWithString: "")
  label.font = NSFont.monospacedDigitSystemFont(ofSize: size, weight: weight)
  label.textColor = color.nsColor
  label.alignment = .center
  label.lineBreakMode = .byClipping
  label.isBezeled = false
  label.drawsBackground = false
  return label
}
