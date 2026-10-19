import AppKit
import CapsuleCore

/// A meter drawn as a tile that drains: full while plenty of the window is
/// left, emptying as it is used. The fill is a tint of the meter's colour
/// with a solid band at the level, so the mark stays legible over it. With
/// the session and the week it splits into two columns, session first, each
/// in its own colour.
@MainActor
final class GaugeLayers {
  let root = CALayer()
  private let theme: HudTheme
  private let size: Double
  private let outline: Double
  private let tracks = [CAShapeLayer(), CAShapeLayer()]
  private let fills = [CAShapeLayer(), CAShapeLayer()]
  private let levels = [CAShapeLayer(), CAShapeLayer()]
  private let sheen = CAGradientLayer()
  private var split: Bool?

  init(size: Double, outline: Double, theme: HudTheme) {
    self.size = size
    self.outline = outline
    self.theme = theme
    root.frame = CGRect(x: 0, y: 0, width: size, height: size)
    root.cornerRadius = size * Gauge.cornerShare
    root.cornerCurve = .continuous
    root.masksToBounds = true
    root.borderColor = theme.ringTrack.cgColor
    for index in tracks.indices {
      for shape in [tracks[index], fills[index], levels[index]] {
        shape.frame = root.bounds
        shape.fillColor = nil
        shape.lineCap = .butt
        root.addSublayer(shape)
      }
      tracks[index].strokeColor = theme.ringTrack.cgColor
      fills[index].strokeEnd = 0
      levels[index].strokeStart = 0
      levels[index].strokeEnd = 0
    }
    sheen.frame = root.bounds
    sheen.colors = [
      ThemeColor(255, 255, 255, Gauge.sheenAlpha).cgColor,
      ThemeColor(255, 255, 255, 0).cgColor,
    ]
    sheen.startPoint = CGPoint(x: 0.5, y: 0)
    sheen.endPoint = CGPoint(x: 0.5, y: 0.5)
    root.addSublayer(sheen)
  }

  /// `used` and `week` are shares used; each column fills with what is left.
  func show(used: Double?, week: Double?, split next: Bool) {
    if split != next {
      split = next
      layout(split: next)
    }
    // No reading yet: an outline, not an empty tile that reads as used up.
    let none = used == nil && (!next || week == nil)
    root.borderWidth = none ? outline : 0
    for (index, track) in tracks.enumerated() { track.isHidden = none || (index == 1 && !next) }
    let readings: [(Double?, MeterRole)] = next ? [(used, .session), (week, .week)] : [(used, .session)]
    for index in fills.indices {
      let (reading, role) = index < readings.count ? readings[index] : (nil, .session)
      let left = reading.map { max(0, min(100, 100 - $0)) / 100 } ?? 0
      let color = reading.map { theme.meterColor($0, role: role) } ?? theme.ringTrack
      let hidden = reading == nil || left <= 0
      fills[index].isHidden = hidden
      levels[index].isHidden = hidden
      fills[index].strokeColor = color.with(alpha: Gauge.fillAlpha).cgColor
      levels[index].strokeColor = color.cgColor
      sweep(fills[index], "strokeEnd", to: left)
      sweep(levels[index], "strokeEnd", to: left)
      sweep(levels[index], "strokeStart", to: max(0, left - Gauge.levelShare))
    }
  }

  private func sweep(_ shape: CAShapeLayer, _ key: String, to target: Double) {
    let current = Double(key == "strokeEnd" ? shape.strokeEnd : shape.strokeStart)
    guard current != target else { return }
    let from = shape.presentation()?.value(forKeyPath: key) ?? current
    shape.setValue(target, forKeyPath: key)
    shape.add(springAnimation(key, Springs.reading, from: from, to: target), forKey: key)
  }

  /// Columns as thick strokes from the bottom up, so a fill sweeps the way
  /// a ring does.
  private func layout(split: Bool) {
    let gap = split ? max(1, jsRound(size * Gauge.gapShare)) : 0
    let width = split ? (size - gap) / 2 : size
    for index in tracks.indices {
      let shown = index == 0 || split
      let x = index == 0 ? width / 2 : size - width / 2
      let path = CGMutablePath()
      path.move(to: CGPoint(x: x, y: size))
      path.addLine(to: CGPoint(x: x, y: 0))
      for shape in [tracks[index], fills[index], levels[index]] {
        shape.path = path
        shape.lineWidth = width
        shape.isHidden = !shown
      }
    }
  }
}
