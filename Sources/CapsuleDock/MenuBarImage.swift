import AppKit
import CapsuleCore
import CapsuleHUD

/// The menu-bar item's picture: each entry's mark with its percentage as
/// text, or a mini bar. Drawn when the bar draws it, so it follows the menu
/// bar's light or dark look.
public enum MenuBarImage {
  public static func render(_ entries: [MenuBarEntry], style: PinStyle) -> NSImage {
    let m = MenuBarMetrics.self
    let font = NSFont.monospacedDigitSystemFont(ofSize: m.fontSize, weight: .medium)
    let labels = entries.map { entry in
      entry.percent.map { "\(jsString(.number($0)))\(Copy.percentSuffix)" } ?? Copy.noReading
    }
    let widths = zip(entries, labels).map { entry, label in
      m.iconSize + m.iconGap
        + (style == .bars && entry.percent != nil
          ? m.barWidth : ceil((label as NSString).size(withAttributes: [.font: font]).width))
    }
    let total = widths.reduce(0, +) + m.entryGap * Double(max(0, entries.count - 1))
    let size = NSSize(width: max(total, m.iconSize), height: m.height)
    let image = NSImage(size: size, flipped: false) { _ in
      var x = 0.0
      for (index, entry) in entries.enumerated() {
        let ink = NSColor.labelColor
        drawIcon(entry.provider, at: NSPoint(x: x, y: (m.height - m.iconSize) / 2), color: ink)
        x += m.iconSize + m.iconGap
        if style == .bars, let percent = entry.percent {
          let track = NSRect(x: x, y: (m.height - m.barHeight) / 2, width: m.barWidth, height: m.barHeight)
          ink.withAlphaComponent(m.trackAlpha).setFill()
          NSBezierPath(roundedRect: track, xRadius: m.barHeight / 2, yRadius: m.barHeight / 2).fill()
          var fill = track
          fill.size.width = track.width * max(0, min(100, percent)) / 100
          SeverityColors.forPercent(entry.used ?? percent).nsColor.setFill()
          NSBezierPath(roundedRect: fill, xRadius: m.barHeight / 2, yRadius: m.barHeight / 2).fill()
        } else {
          let text = labels[index] as NSString
          let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: ink]
          let height = text.size(withAttributes: attributes).height
          text.draw(at: NSPoint(x: x, y: (m.height - height) / 2), withAttributes: attributes)
        }
        x = widths.prefix(index + 1).reduce(0, +) + m.entryGap * Double(index + 1)
      }
      return true
    }
    image.isTemplate = false
    return image
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
