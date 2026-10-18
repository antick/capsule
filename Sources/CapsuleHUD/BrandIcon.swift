import AppKit
import CapsuleCore

/// One drawing for the bundle, in-app branding, and the menu-bar template.
@MainActor
public enum BrandIcon {
  public static func image(size: CGFloat = Branding.artboard, template: Bool = false) -> NSImage {
    let dimensions = template ? Branding.menuSize : CGSize(width: size, height: size)
    let image = NSImage(size: dimensions, flipped: false) { _ in
      guard let context = NSGraphicsContext.current?.cgContext else { return false }
      if template {
        drawMeter(context, rect: Branding.menuCapsule, inset: Branding.menuInset,
                  outline: CGColor(gray: 0, alpha: 1), fill: CGColor(gray: 0, alpha: 1))
      } else {
        context.scaleBy(x: size / Branding.artboard, y: size / Branding.artboard)
        context.setFillColor(color(Branding.charcoal))
        context.addPath(CGPath(roundedRect: Branding.tile, cornerWidth: Branding.tileRadius,
                              cornerHeight: Branding.tileRadius, transform: nil))
        context.fillPath()
        drawMeter(context, rect: Branding.capsule, inset: Branding.inset,
                  outline: color(Branding.cream), fill: color(Branding.amber))
      }
      return true
    }
    image.isTemplate = template
    image.accessibilityDescription = AppIdentity.name
    return image
  }

  private static func color(_ rgb: (red: Double, green: Double, blue: Double)) -> CGColor {
    CGColor(srgbRed: rgb.red / 255, green: rgb.green / 255, blue: rgb.blue / 255, alpha: 1)
  }

  private static func drawMeter(_ context: CGContext, rect: CGRect, inset: CGFloat,
                                outline: CGColor, fill: CGColor) {
    let inner = rect.insetBy(dx: inset, dy: inset)
    context.setFillColor(outline)
    context.addPath(CGPath(roundedRect: rect, cornerWidth: rect.height / 2,
                          cornerHeight: rect.height / 2, transform: nil))
    context.addPath(CGPath(roundedRect: inner, cornerWidth: inner.height / 2,
                          cornerHeight: inner.height / 2, transform: nil))
    context.drawPath(using: .eoFill)
    let filled = CGRect(x: inner.minX, y: inner.minY,
                        width: inner.width * Branding.progress, height: inner.height)
    context.setFillColor(fill)
    context.addPath(CGPath(roundedRect: filled, cornerWidth: filled.height / 2,
                          cornerHeight: filled.height / 2, transform: nil))
    context.fillPath()
  }
}
