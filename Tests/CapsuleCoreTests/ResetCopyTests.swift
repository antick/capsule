import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

@Suite("Reset and elapsed copy, against the shared corpus")
struct ResetCopyTests {
  @Test("formatResetRelative")
  func resetRelative() throws {
    let file: FixtureFile<AtInput, String> = try Fixtures.load(
      "dates/reset-relative"
    )
    let now = try file.now()
    for testCase in file.cases {
      let resetsAt = try file.date(testCase.input.resetsAt)
      #expect(
        formatResetRelative(resetsAt, now: now) == testCase.expected,
        "\(testCase.name)"
      )
    }
  }

  @Test("formatResetAbsolute")
  func resetAbsolute() throws {
    let file: FixtureFile<AtInput, String> = try Fixtures.load(
      "dates/reset-absolute"
    )
    let now = try file.now()
    let zone = try file.zone()
    for testCase in file.cases {
      let resetsAt = try file.date(testCase.input.resetsAt)
      let actual = formatResetAbsolute(
        resetsAt, locale: file.foundationLocale, now: now, timeZone: zone
      )
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  /// The corpus was written against JavaScript, which emits U+0020 before
  /// AM/PM. Foundation can emit U+202F instead, depending on how the time is
  /// formatted. This passes today without the normalisation in
  /// `ResetCopy.swift` doing anything; it is here so that the day a toolchain
  /// changes its mind, a test fails instead of every user's dock quietly
  /// gaining an invisible character.
  @Test("the meridiem space stays an ordinary space")
  func meridiemSpace() throws {
    let file: FixtureFile<AtInput, String> = try Fixtures.load(
      "dates/reset-absolute"
    )
    let now = try file.now()
    let zone = try file.zone()
    let rendered = try file.cases.map { testCase in
      formatResetAbsolute(
        try file.date(testCase.input.resetsAt),
        locale: file.foundationLocale, now: now, timeZone: zone
      )
    }
    #expect(rendered.allSatisfy { !$0.unicodeScalars.contains("\u{202F}") })
    #expect(rendered.contains { $0.contains(" AM") || $0.contains(" PM") })
  }

  @Test("formatElapsed")
  func elapsed() throws {
    let file: FixtureFile<SpanInput, String> = try Fixtures.load(
      "dates/elapsed"
    )
    let now = try file.now()
    for testCase in file.cases {
      let since = now.addingTimeInterval(-testCase.input.msBeforeNow / 1000)
      #expect(
        formatElapsed(since: since, now: now) == testCase.expected,
        "\(testCase.name)"
      )
    }
  }

  @Test("formatAgo")
  func ago() throws {
    let file: FixtureFile<SpanInput, String> = try Fixtures.load("dates/ago")
    let now = try file.now()
    for testCase in file.cases {
      let since = now.addingTimeInterval(-testCase.input.msBeforeNow / 1000)
      #expect(
        formatAgo(since: since, now: now) == testCase.expected,
        "\(testCase.name)"
      )
    }
  }
}
