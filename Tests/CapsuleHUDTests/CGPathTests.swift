import CapsuleCore
import CapsuleHUD
import CoreGraphics
import Testing

/// The corpus checks the commands; these check that the commands become the
/// shape they describe. A sweep read backwards would bend every corner inward
/// and fail here, though every fixture still passed.
@Suite("Outlines as CGPath")
struct CGPathTests {
  private func approximately(_ a: CGRect, _ b: CGRect, within tolerance: Double = 0.01) -> Bool {
    abs(a.minX - b.minX) < tolerance && abs(a.minY - b.minY) < tolerance
      && abs(a.width - b.width) < tolerance && abs(a.height - b.height) < tolerance
  }

  @Test("a rounded rectangle fills its rect and rounds its corners outward")
  func roundedRectangle() {
    let rect = Rect(x: 10, y: 20, width: 100, height: 40)
    let path = cgPath(roundedRect(mapperFor(.left, canonicalWidth: 300), rect, radius: 12))
    #expect(approximately(path.boundingBoxOfPath, CGRect(x: 10, y: 20, width: 100, height: 40)))
    #expect(path.contains(CGPoint(x: 60, y: 40)), "the middle is inside")
    #expect(path.contains(CGPoint(x: 13, y: 40)), "just inside the left side")
    #expect(!path.contains(CGPoint(x: 10.5, y: 20.5)), "the cut-off corner is outside")
    // A convex corner arc passes through (cx - r cos 45°, cy - r sin 45°).
    #expect(path.contains(CGPoint(x: 22 - 12 * 0.7071 + 0.5, y: 32 - 12 * 0.7071 + 0.5)))
  }

  @Test("mirroring keeps the shape and flips the sweep")
  func mirrored() {
    let rect = Rect(x: 10, y: 20, width: 100, height: 40)
    let mapper = mapperFor(.right, canonicalWidth: 300)
    let path = cgPath(roundedRect(mapper, rect, radius: 12))
    let mapped = mapRect(rect, growth: .right, canonicalWidth: 300)
    #expect(
      approximately(
        path.boundingBoxOfPath,
        CGRect(x: mapped.x, y: mapped.y, width: mapped.width, height: mapped.height)
      )
    )
    #expect(!path.contains(CGPoint(x: mapped.x + 0.5, y: mapped.y + 0.5)))
    #expect(path.contains(CGPoint(x: mapped.x + mapped.width / 2, y: mapped.y + mapped.height / 2)))
  }

  @Test("the rail's fillets reach past the rail into the screen edge")
  func railFillets() {
    let m = hudMetrics(1)
    let layout = blobLayout(
      m,
      BlobLayoutInput(
        cardGrowth: .left, railLength: railLengthForCount(m, 3),
        joinOffset: joinOffsetForIndex(m, 0), style: .rail
      )
    )
    let path = cgPath(railPath(m, .left, layout, style: .rail))
    let box = path.boundingBoxOfPath
    let rail = layout.rail
    // Flush with the right edge of the frame, and longer than the rail body by
    // a fillet at each end.
    #expect(abs(box.maxX - (rail.x + rail.width)) < 0.01)
    #expect(abs(box.minY - (rail.y - m.edgeFlare)) < 0.01)
    #expect(abs(box.maxY - (rail.y + rail.height + m.edgeFlare)) < 0.01)
    #expect(path.contains(CGPoint(x: rail.x + rail.width / 2, y: rail.y + rail.height / 2)))
    // The fillet is concave: just inside the corner it carves away is empty.
    #expect(!path.contains(CGPoint(x: rail.x + rail.width - m.edgeFlare + 1, y: rail.y - m.edgeFlare + 1)))
  }

  @Test("the bubble holds the card and reaches the rail")
  func bubble() {
    let m = hudMetrics(1)
    let layout = blobLayout(
      m,
      BlobLayoutInput(
        cardGrowth: .left, railLength: railLengthForCount(m, 3),
        joinOffset: joinOffsetForIndex(m, 1), style: .rail
      )
    )
    let path = cgPath(bubblePath(m, .left, layout))
    let card = layout.card
    #expect(path.contains(CGPoint(x: card.x + card.width / 2, y: card.y + card.height / 2)))
    // The tail tip lands on, and a hair past, the rail's inner face.
    #expect(path.boundingBoxOfPath.maxX >= layout.tip.x - 0.01)
  }
}
