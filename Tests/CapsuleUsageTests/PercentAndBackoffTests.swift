import CapsuleCore
import CapsuleFixtures
import CapsuleUsage
import Foundation
import Testing

struct BackoffInput: Decodable {
  let refusals: Int
  let retryAfterMs: Int?
}

struct HeaderInput: Decodable {
  let header: String?
}

@Suite("Percents and backoff, against the shared corpus")
struct PercentAndBackoffTests {
  @Test("clampPercent")
  func clamp() throws {
    let file: FixtureFile<Double, Double> = try Fixtures.load(
      "usage/clamp-percent"
    )
    for testCase in file.cases {
      #expect(clampPercent(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("toPercent")
  func percent() throws {
    let file: FixtureFile<Double, Double> = try Fixtures.load("usage/to-percent")
    for testCase in file.cases {
      #expect(toPercent(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  /// The fixtures hold literal milliseconds so both languages can read them.
  /// That only stays honest while the literals agree with the constants the
  /// app actually backs off by.
  @Test("fixture literals still match the configured floor and ceiling")
  func policyMatchesFixtures() {
    #expect(BackoffPolicy.floorMs == 60_000)
    #expect(BackoffPolicy.ceilingMs == 900_000)
  }

  @Test("backoffMs")
  func backoff() throws {
    let file: FixtureFile<BackoffInput, Int> = try Fixtures.load("usage/backoff")
    for testCase in file.cases {
      let actual = backoffMs(
        refusals: testCase.input.refusals,
        retryAfterMs: testCase.input.retryAfterMs
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("retryAfterMs")
  func retryAfter() throws {
    let file: FixtureFile<HeaderInput, Int?> = try Fixtures.load(
      "usage/retry-after"
    )
    let now = try file.now()
    for testCase in file.cases {
      let actual = retryAfterMs(header: testCase.input.header, now: now)
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }
}
