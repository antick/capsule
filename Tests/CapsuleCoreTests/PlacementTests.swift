import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

struct Point: Decodable {
  let x: Double
  let y: Double
}

struct PlacementInput: Decodable {
  let preset: PlacementPreset
  let chrome: ChromeSnapshot
  let hud: HudSize
  let notchAllowed: Bool
}

struct DockAlongInput: Decodable {
  let track: SlideTrack
  let railStart: Double
}

struct DockAlongOutput: Decodable, Equatable {
  let window: Double
  let railBias: Double
}

struct SlideInput: Decodable {
  let slide: SlideTrack
  let anchorX: Double
  let anchorY: Double
  let cursor: Point
  let grabOffset: Double
}

struct NearestInput: Decodable {
  let point: Point
  let bounds: Rect
}

struct ZoomInput: Decodable {
  let target: WindowBox
  let current: WindowBox
  let cardGrowth: CardGrowth
}

struct PresetMeaning: Decodable, Equatable {
  let edge: ScreenEdge
  let layout: PresetLayout
  let presetForEdge: PlacementPreset
  let label: String
  let hint: String
}

@Suite("Placement and edge snapping, against the shared corpus")
struct PlacementTests {
  @Test("computePlacement")
  func placement() throws {
    let file: FixtureFile<PlacementInput, PlacementResult> = try Fixtures.load(
      "placement/compute-placement"
    )
    for testCase in file.cases {
      let input = testCase.input
      let actual = computePlacement(
        input.preset, chrome: input.chrome, hud: input.hud,
        notchAllowed: input.notchAllowed
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("dockAlongEdge")
  func dockAlong() throws {
    let file: FixtureFile<DockAlongInput, DockAlongOutput> = try Fixtures.load(
      "placement/dock-along-edge"
    )
    for testCase in file.cases {
      let placed = dockAlongEdge(
        testCase.input.track, railStart: testCase.input.railStart
      )
      let actual = DockAlongOutput(window: placed.window, railBias: placed.railBias)
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("slideAlongEdge")
  func slide() throws {
    let file: FixtureFile<SlideInput, SlidePosition> = try Fixtures.load(
      "placement/slide-along-edge"
    )
    for testCase in file.cases {
      let input = testCase.input
      let actual = slideAlongEdge(
        slide: input.slide, anchorX: input.anchorX, anchorY: input.anchorY,
        cursor: (input.cursor.x, input.cursor.y), grabOffset: input.grabOffset
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("nearestEdgeForPoint")
  func nearestEdge() throws {
    let file: FixtureFile<NearestInput, ScreenEdge> = try Fixtures.load(
      "placement/nearest-edge"
    )
    for testCase in file.cases {
      let input = testCase.input
      let actual = nearestEdgeForPoint(
        point: (input.point.x, input.point.y), bounds: input.bounds
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("zoomHoldBounds")
  func zoomHold() throws {
    let file: FixtureFile<ZoomInput, WindowBox> = try Fixtures.load(
      "placement/zoom-hold-bounds"
    )
    for testCase in file.cases {
      let input = testCase.input
      let actual = zoomHoldBounds(
        target: input.target, current: input.current,
        cardGrowth: input.cardGrowth
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("what each preset means")
  func presets() throws {
    let file: FixtureFile<PlacementPreset, PresetMeaning> = try Fixtures.load(
      "placement/layout-for-preset"
    )
    for testCase in file.cases {
      let preset = testCase.input
      let edge = edgeForPreset(preset)
      let actual = PresetMeaning(
        edge: edge, layout: layoutForPreset(preset),
        presetForEdge: presetForEdge(edge), label: preset.label,
        hint: preset.hint
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }
}
