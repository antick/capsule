import AppKit
import CapsuleCore
import CapsuleHUD

/// The menu-bar item's picture: each provider's mark with its figures beside
/// it, as text or mini bars. Two figures stack, session above week, so a
/// provider stays one item. Drawn when the bar draws it, so it follows the
/// menu bar's light or dark look.
public enum MenuBarImage {
  public static func render(_ entries: [MenuBarEntry], style: PinStyle) -> NSImage {
    let m = MenuBarMetrics.self
    let widths = entries.map { m.iconSize + m.iconGap + figuresWidth($0.values, style: style) }
    let total = widths.reduce(0, +) + m.entryGap * Double(max(0, entries.count - 1))
    let size = NSSize(width: max(total, m.iconSize), height: m.height)
    let image = NSImage(size: size, flipped: false) { _ in
      var x = 0.0
      for (index, entry) in entries.enumerated() {
        let ink = NSColor.labelColor
        drawIcon(entry.provider, at: NSPoint(x: x, y: (m.height - m.iconSize) / 2), color: ink)
        x += m.iconSize + m.iconGap
        drawFigures(entry.values, style: style, at: x, ink: ink)
        x = widths.prefix(index + 1).reduce(0, +) + m.entryGap * Double(index + 1)
      }
      return true
    }
    image.isTemplate = false
    return image
  }

  private static func font(_ count: Int) -> NSFont {
    let stacked = count > 1
    return NSFont.monospacedDigitSystemFont(
      ofSize: stacked ? MenuBarMetrics.stackedFontSize : MenuBarMetrics.fontSize, weight: stacked ? .semibold : .medium)
  }

  private static func label(_ value: MenuBarValue) -> String {
    value.percent.map { "\(jsString(.number($0)))\(Copy.percentSuffix)" } ?? Copy.noReading
  }

  private static func figuresWidth(_ values: [MenuBarValue], style: PinStyle) -> Double {
    if style == .bars { return MenuBarMetrics.barWidth }
    let attributes: [NSAttributedString.Key: Any] = [.font: font(values.count)]
    return values.map { ceil((label($0) as NSString).size(withAttributes: attributes).width) }.max() ?? 0
  }

  private static func drawFigures(_ values: [MenuBarValue], style: PinStyle, at x: Double, ink: NSColor) {
    let m = MenuBarMetrics.self
    let stacked = values.count > 1
    if style == .bars {
      let height = stacked ? m.stackedBarHeight : m.barHeight
      let block = Double(values.count) * height + Double(values.count - 1) * m.stackedGap
      // Top row first: the session above the week.
      for (row, value) in values.enumerated() {
        let y = (m.height + block) / 2 - Double(row + 1) * height - Double(row) * m.stackedGap
        let track = NSRect(x: x, y: y, width: m.barWidth, height: height)
        ink.withAlphaComponent(m.trackAlpha).setFill()
        NSBezierPath(roundedRect: track, xRadius: height / 2, yRadius: height / 2).fill()
        guard let percent = value.percent else { continue }
        var fill = track
        fill.size.width = track.width * max(0, min(100, percent)) / 100
        SeverityColors.forPercent(value.used ?? percent).nsColor.setFill()
        NSBezierPath(roundedRect: fill, xRadius: height / 2, yRadius: height / 2).fill()
      }
      return
    }
    let attributes: [NSAttributedString.Key: Any] = [.font: font(values.count), .foregroundColor: ink]
    let lineHeight = ("0" as NSString).size(withAttributes: attributes).height
    let block = stacked ? lineHeight * 2 - m.stackedGap : lineHeight
    for (row, value) in values.enumerated() {
      let y = (m.height + block) / 2 - lineHeight - Double(row) * (lineHeight - m.stackedGap)
      (label(value) as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: attributes)
    }
  }

  private static func drawIcon(_ id: ProviderId, at origin: NSPoint, color: NSColor) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    let scale = MenuBarMetrics.iconSize / ProviderIcons.artboard
    context.saveGState()
    context.translateBy(x: origin.x, y: origin.y)
    context.scaleBy(x: scale, y: scale)
    for shape in ProviderIcons.shapes(id) {
      context.addPath(shape.path)
      context.setFillColor(color.withAlphaComponent(shape.opacity).cgColor)
      context.fillPath(using: shape.evenOdd ? .evenOdd : .winding)
    }
    context.restoreGState()
  }
}
