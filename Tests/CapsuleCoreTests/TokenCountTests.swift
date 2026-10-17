import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

@Suite("Token counts and day keys, against the shared corpus")
struct TokenCountTests {
  @Test("formatCompactCount")
  func compactCount() throws {
    let file: FixtureFile<Double, String> = try Fixtures.load(
      "activity/compact-count"
    )
    for testCase in file.cases {
      #expect(
        formatCompactCount(testCase.input) == testCase.expected,
        "\(testCase.name) (\(testCase.input))"
      )
    }
  }

  @Test("dayKey over startOfDay")
  func dayKeys() throws {
    let file: FixtureFile<DayInput, String> = try Fixtures.load(
      "dates/day-keys"
    )
    let zone = try file.zone()
    for testCase in file.cases {
      let now = try file.date(testCase.input.now)
      let start = startOfDay(
        now, daysAgo: testCase.input.daysBack, timeZone: zone
      )
      #expect(dayKey(start, timeZone: zone) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("startOfDay lands on midnight")
  func midnight() throws {
    let file: FixtureFile<DayInput, String> = try Fixtures.load(
      "dates/day-keys"
    )
    let zone = try file.zone()
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    for testCase in file.cases {
      let start = startOfDay(try file.date(testCase.input.now), timeZone: zone)
      #expect(calendar.component(.hour, from: start) == 0, "\(testCase.name)")
    }
  }
}
