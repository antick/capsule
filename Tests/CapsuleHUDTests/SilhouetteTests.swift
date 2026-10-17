import CapsuleCore
import CapsuleFixtures
import CapsuleHUD
import Foundation
import Testing

struct LatchExpected: Decodable, Equatable {
  let resting: Rect
  let latch: Rect
  let hotZone: Rect
  let stowShift: PathPoint
}

struct MorphExpected: Decodable {
  let rail: Rect
  let path: [RecordedCommand]
  let clip: [RecordedCommand]
}

struct PaddingInput: Decodable {
  let scale: Double
  let growth: CardGrowth
  let style: DockStyleId
}

@Suite("Dock silhouettes, against the shared corpus")
struct SilhouetteTests {
  @Test("blobLayout")
  func layout() throws {
    let file: FixtureFile<DockInput, BlobLayout> = try Fixtures.load(
      "hud-paths/blob-layout"
    )
    for testCase in file.cases {
      #expect(draw(testCase.input).layout == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("railPath")
  func rail() throws {
    let file: FixtureFile<DockInput, [RecordedCommand]> = try Fixtures.load(
      "hud-paths/rail-path"
    )
    for testCase in file.cases {
      let (m, style, layout) = draw(testCase.input)
      let actual = railPath(
        m, testCase.input.growth, layout,
        notch: testCase.input.notch ?? false, style: style
      )
      #expect(actual == commands(testCase.expected), "\(testCase.name)")
    }
  }

  @Test("bubblePath")
  func bubble() throws {
    let file: FixtureFile<DockInput, [RecordedCommand]> = try Fixtures.load(
      "hud-paths/bubble-path"
    )
    for testCase in file.cases {
      let (m, _, layout) = draw(testCase.input)
      let actual = bubblePath(m, testCase.input.growth, layout)
      #expect(actual == commands(testCase.expected), "\(testCase.name)")
    }
  }

  @Test("framePadding")
  func padding() throws {
    let file: FixtureFile<PaddingInput, FramePadding> = try Fixtures.load(
      "hud-paths/frame-padding"
    )
    for testCase in file.cases {
      let input = testCase.input
      let actual = framePadding(
        hudMetrics(input.scale), input.growth, style: DockStyle.of(input.style)
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("hitRegions")
  func hits() throws {
    let file: FixtureFile<DockInput, HitRegions> = try Fixtures.load(
      "hud-paths/hit-regions"
    )
    for testCase in file.cases {
      let input = testCase.input
      let (m, style, layout) = draw(input)
      let actual = hitRegions(
        layout, padding: framePadding(m, input.growth, style: style),
        open: input.state == "open",
        latchZone: input.state == "latched"
          ? latchHotZone(m, input.growth, layout) : nil
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("the latch")
  func latch() throws {
    let file: FixtureFile<DockInput, LatchExpected> = try Fixtures.load(
      "hud-paths/latch"
    )
    for testCase in file.cases {
      let input = testCase.input
      let (m, _, layout) = draw(input)
      let actual = LatchExpected(
        resting: restingRail(m, layout, joined: input.joined),
        latch: latchRect(m, input.growth, layout, joined: input.joined),
        hotZone: latchHotZone(m, input.growth, layout, joined: input.joined),
        stowShift: stowShift(m, input.growth)
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("railMorph")
  func morph() throws {
    let file: FixtureFile<DockInput, MorphExpected> = try Fixtures.load(
      "hud-paths/rail-morph"
    )
    for testCase in file.cases {
      let input = testCase.input
      let (m, style, layout) = draw(input)
      let actual = railMorph(
        m, input.growth, layout, openness: input.openness ?? 1,
        notch: input.notch ?? false, style: style,
        resting: input.joined.map { restingRail(m, layout, joined: $0) }
      )
      #expect(actual.rail == testCase.expected.rail, "\(testCase.name): rail")
      #expect(actual.path == commands(testCase.expected.path), "\(testCase.name): path")
      #expect(actual.clip == commands(testCase.expected.clip), "\(testCase.name): clip")
    }
  }
}

struct PrimitiveInput: Decodable {
  let fn: String
  let value: Double?
  let growth: CardGrowth?
  let canonicalWidth: Double?
  let points: [[Double]]?
  let rect: Rect?
  let radius: Double?
}

struct MapperExpected: Decodable {
  let mirrored: Bool
  let points: [[Double]]
}

struct RoundedExpected: Decodable {
  let value: Double
}

@Suite("The path builder's own pieces, against the shared corpus")
struct PathPrimitiveTests {
  @Test("n, mapperFor, mapRect and roundedRect")
  func primitives() throws {
    let file: FixtureFile<PrimitiveInput, JSONValue> = try Fixtures.load(
      "hud-paths/primitives"
    )
    for testCase in file.cases {
      let input = testCase.input
      let growth = input.growth ?? .left
      let width = input.canonicalWidth ?? 0
      switch input.fn {
      case "n":
        // The text is SVG formatting; the number is what a port must match.
        let expected: RoundedExpected = try reread(testCase.expected)
        #expect(n(input.value ?? .nan) == expected.value, "\(testCase.name)")
      case "mapper":
        let expected: MapperExpected = try reread(testCase.expected)
        let mapper = mapperFor(growth, canonicalWidth: width)
        let points = (input.points ?? []).map { mapper.point($0[0], $0[1]) }
        #expect(mapper.mirrored == expected.mirrored, "\(testCase.name): mirrored")
        #expect(points.map { [$0.x, $0.y] } == expected.points, "\(testCase.name): points")
      case "mapRect":
        let expected: Rect = try reread(testCase.expected)
        let rect = try #require(input.rect)
        #expect(mapRect(rect, growth: growth, canonicalWidth: width) == expected, "\(testCase.name)")
      case "roundedRect":
        let expected: [RecordedCommand] = try reread(testCase.expected)
        let rect = try #require(input.rect)
        let actual = roundedRect(
          mapperFor(growth, canonicalWidth: width), rect, radius: input.radius ?? 0
        )
        #expect(actual == commands(expected), "\(testCase.name)")
      default:
        Issue.record("unknown primitive: \(input.fn)")
      }
    }
  }
}
