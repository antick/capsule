import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

struct DirectionInput: Decodable {
  let scale: Double
  let direction: Int
}

struct RailSizeInput: Decodable {
  let scale: Double
  let compact: Bool
  let count: Int
}

struct RailSizes: Decodable, Equatable {
  let meterBlock: Double
  let meterStride: Double
  let railLength: Double
  let joinOffsets: [Double]
}

struct CardHeightInput: Decodable {
  let scale: Double
  let buckets: Int?
  let sessions: Int?
  let tokens: Bool?
  let named: String?
}

struct NotchInput: Decodable {
  let scale: Double
  let kind: String
  let menuBarHeight: Double?
  let count: Int?
  let compact: Bool?
  let railLength: Double?
  let notch: HardwareNotch?
}

@Suite("HUD metrics and scale, against the shared corpus")
struct MetricsTests {
  @Test("hudMetrics")
  func metrics() throws {
    let file: FixtureFile<Double, HudMetrics> = try Fixtures.load(
      "hud-metrics/metrics"
    )
    for testCase in file.cases {
      #expect(hudMetrics(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("clampHudScale")
  func clamp() throws {
    let file: FixtureFile<Double, Double> = try Fixtures.load(
      "hud-metrics/clamp-scale"
    )
    for testCase in file.cases {
      #expect(clampHudScale(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("hudScaleRange")
  func range() throws {
    let file: FixtureFile<Double, Double> = try Fixtures.load(
      "hud-metrics/scale-range"
    )
    for testCase in file.cases {
      #expect(hudScaleRange(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("nextHudScale")
  func next() throws {
    let file: FixtureFile<DirectionInput, Double> = try Fixtures.load(
      "hud-metrics/next-scale"
    )
    for testCase in file.cases {
      let actual = nextHudScale(
        testCase.input.scale, direction: testCase.input.direction
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("hudScaleSteps")
  func steps() throws {
    let file: FixtureFile<Int?, [Double]> = try Fixtures.load(
      "hud-metrics/scale-steps"
    )
    #expect(hudScaleSteps() == file.cases.first?.expected)
  }

  @Test("rail sizes")
  func railSizes() throws {
    let file: FixtureFile<RailSizeInput, RailSizes> = try Fixtures.load(
      "hud-metrics/rail-sizes"
    )
    for testCase in file.cases {
      let input = testCase.input
      let m = hudMetrics(input.scale)
      let actual = RailSizes(
        meterBlock: meterBlockSize(m, compact: input.compact),
        meterStride: meterStrideSize(m, compact: input.compact),
        railLength: railLengthForCount(m, input.count, compact: input.compact),
        joinOffsets: (0..<max(1, input.count)).map {
          joinOffsetForIndex(m, $0, compact: input.compact)
        }
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("card height")
  func cardHeight() throws {
    let file: FixtureFile<CardHeightInput, Double> = try Fixtures.load(
      "hud-metrics/card-height"
    )
    for testCase in file.cases {
      let input = testCase.input
      let m = hudMetrics(input.scale)
      let actual: Double
      switch input.named {
      case "reserve": actual = cardReserveHeight(m)
      case "message": actual = cardMessageHeight(m)
      case "buckets": actual = cardHeightForBuckets(m, input.buckets ?? 0)
      default:
        actual = cardHeightFor(
          m, buckets: input.buckets ?? 0, sessions: input.sessions ?? 0,
          tokens: input.tokens ?? false
        )
      }
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("sessionRowsShown")
  func sessionRows() throws {
    let file: FixtureFile<Int, SessionRows> = try Fixtures.load(
      "hud-metrics/session-rows"
    )
    for testCase in file.cases {
      #expect(sessionRowsShown(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("notch geometry")
  func notch() throws {
    let file: FixtureFile<NotchInput, JSONValue> = try Fixtures.load(
      "hud-metrics/notch"
    )
    for testCase in file.cases {
      let input = testCase.input
      let m = hudMetrics(input.scale)
      let count = input.count ?? 1
      switch input.kind {
      case "virtual":
        let actual = virtualNotch(m, menuBarHeight: input.menuBarHeight ?? 0)
        #expect(
          testCase.expected["width"]?.asDouble == actual.width
            && testCase.expected["height"]?.asDouble == actual.height,
          "\(testCase.name)"
        )
      case "joined":
        let actual = joinedNotchRailLength(
          m, count, notch: input.notch ?? HardwareNotch(width: 0, height: 0)
        )
        #expect(testCase.expected.asDouble == actual, "\(testCase.name)")
      default:
        let compact = input.compact ?? false
        // A null length means "exactly what the meters need".
        let railLength =
          input.railLength ?? railLengthForCount(m, count, compact: compact)
        let actual = railEndSpread(
          m, count, compact: compact, railLength: railLength
        )
        #expect(testCase.expected.asDouble == actual, "\(testCase.name)")
      }
    }
  }

  /// The case that tells `jsRound` apart from Swift's default rounding.
  @Test("negative halves round toward +∞, as Math.round does")
  func roundingMatchesJavaScript() {
    #expect(jsRound(-2.5) == -2)
    #expect(jsRound(2.5) == 3)
    #expect(jsRound(0.49999999999999994) == 0)
    #expect(jsRound(-0.5) == 0)
  }
}
