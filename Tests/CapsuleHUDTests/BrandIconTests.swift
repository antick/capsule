import AppKit
import CapsuleCore
import Testing
@testable import CapsuleHUD

@MainActor
@Suite("Capsule branding")
struct BrandIconTests {
  @Test func appAndMenuImagesRenderWithTransparentMargins() throws {
    for template in [false, true] {
      let image = BrandIcon.image(template: template)
      #expect(image.isTemplate == template)
      #expect(image.accessibilityDescription == AppIdentity.name)
      let data = try #require(image.tiffRepresentation)
      let bitmap = try #require(NSBitmapImageRep(data: data))
      #expect(bitmap.hasAlpha)
      #expect(try #require(bitmap.colorAt(x: 0, y: 0)).alphaComponent == 0)
      #expect(bitmap.pixelsWide > 0 && bitmap.pixelsHigh > 0)
      let scale = CGFloat(bitmap.pixelsWide) / image.size.width
      func pixel(_ x: CGFloat, _ y: CGFloat) throws -> NSColor {
        try #require(bitmap.colorAt(x: Int(x * scale), y: Int(y * scale))?.usingColorSpace(.deviceRGB))
      }
      if template {
        #expect(try pixel(5, 9).alphaComponent > 0.9)
        #expect(try pixel(17, 9).alphaComponent < 0.1)
      } else {
        let filled = try pixel(300, 512)
        #expect(filled.redComponent > 0.95 && filled.greenComponent > 0.6)
        #expect(filled.blueComponent < 0.15)
        let empty = try pixel(750, 512)
        #expect(empty.redComponent < 0.2 && empty.alphaComponent > 0.95)
      }
    }
  }
}
