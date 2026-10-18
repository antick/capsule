import CapsuleCore
import CoreGraphics
import Testing

@testable import CapsuleHUD

@Suite("Provider marks")
struct IconTests {
  @Test func everyMarkFillsItsArtboard() {
    let board = CGRect(x: 0, y: 0, width: ProviderIcons.artboard, height: ProviderIcons.artboard)
    for id in ProviderId.allCases {
      let shapes = ProviderIcons.shapes(id)
      #expect(!shapes.isEmpty, "\(id)")
      let bounds = shapes.map(\.path.boundingBoxOfPath).reduce(CGRect.null) { $0.union($1) }
      // Inside the artboard, and covering most of it: a parse that stopped
      // early would leave a small or empty box.
      #expect(board.insetBy(dx: -0.5, dy: -0.5).contains(bounds), "\(id) \(bounds)")
      #expect(bounds.width > 15 && bounds.height > 15, "\(id) \(bounds)")
    }
  }

  @Test func relativeCommandsAndPackedFlagsParse() {
    // A relative move, a packed-flag arc and an implicit line repeat.
    let path = svgPath("m2 2a2 2 0 002 2l2 0 0 2z")
    let box = path.boundingBoxOfPath
    #expect(abs(box.minX - 2) < 0.01)
    #expect(abs(box.maxX - 6) < 0.01)
    #expect(abs(box.maxY - 6) < 0.01)
  }

  @Test func aHalfCircleArcBulgesTheRightWay() {
    // From (0,10) to (20,10), radius 10, sweep 1: in SVG's y-down space this
    // is the upper half, so the box reaches y = 0.
    let box = svgPath("M0 10A10 10 0 0 1 20 10").boundingBoxOfPath
    #expect(abs(box.minY) < 0.05)
    #expect(abs(box.maxY - 10) < 0.05)
  }
}
