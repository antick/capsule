import AppKit
import CapsuleCore

/// A short burst of confetti across the screen the dock is on, for a weekly
/// window starting again. Click-through, above everything, and skipped when
/// the user has asked for less motion.
@MainActor
final class Confetti {
  private var window: NSWindow?

  func burst(on screen: NSScreen?) {
    guard !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion, window == nil,
      let screen = screen ?? NSScreen.main
    else { return }
    let frame = screen.frame
    let panel = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.ignoresMouseEvents = true
    panel.level = .screenSaver
    panel.collectionBehavior = [.canJoinAllSpaces, .transient, .ignoresCycle]
    let host = NSView(frame: NSRect(origin: .zero, size: frame.size))
    host.wantsLayer = true
    let emitter = CAEmitterLayer()
    emitter.emitterPosition = CGPoint(x: frame.width / 2, y: frame.height + ConfettiTuning.overshoot)
    emitter.emitterShape = .line
    emitter.emitterSize = CGSize(width: frame.width, height: 1)
    emitter.emitterCells = ConfettiTuning.colors.map { color in
      let cell = CAEmitterCell()
      cell.contents = Self.piece
      cell.color = color.cgColor
      cell.birthRate = ConfettiTuning.birthRate
      cell.lifetime = ConfettiTuning.lifetime
      cell.velocity = ConfettiTuning.velocity
      cell.velocityRange = ConfettiTuning.velocity / 2
      cell.emissionLongitude = .pi
      cell.emissionRange = .pi / 5
      cell.yAcceleration = -ConfettiTuning.gravity
      cell.spin = 3
      cell.spinRange = 6
      cell.scale = 0.6
      cell.scaleRange = 0.3
      return cell
    }
    host.layer?.addSublayer(emitter)
    panel.contentView = host
    panel.orderFrontRegardless()
    window = panel
    DispatchQueue.main.asyncAfter(deadline: .now() + ConfettiTuning.emitSeconds) { emitter.birthRate = 0 }
    DispatchQueue.main.asyncAfter(deadline: .now() + ConfettiTuning.totalSeconds) { [weak self] in
      self?.window?.orderOut(nil)
      self?.window = nil
    }
  }

  private static let piece: CGImage? = {
    let size = NSSize(width: 8, height: 12)
    let image = NSImage(size: size, flipped: false) { rect in
      NSColor.white.setFill()
      NSBezierPath(roundedRect: rect, xRadius: 1.5, yRadius: 1.5).fill()
      return true
    }
    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  }()
}

enum ConfettiTuning {
  static let colors: [NSColor] = [.systemPink, .systemYellow, .systemGreen, .systemBlue, .systemOrange, .systemPurple]
  static let birthRate: Float = 18
  static let lifetime: Float = 6
  static let velocity: CGFloat = 220
  static let gravity: CGFloat = 160
  static let overshoot: CGFloat = 20
  static let emitSeconds = 1.6
  static let totalSeconds = 6.5
}
