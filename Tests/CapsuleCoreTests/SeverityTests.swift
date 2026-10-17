import CapsuleCore
import CapsuleFixtures
import Testing

@Suite("Severity bands, against the shared corpus")
struct SeverityTests {
  @Test("severityForPercent")
  func forPercent() throws {
    let file: FixtureFile<Double, String> = try Fixtures.load(
      "severity/for-percent"
    )
    for testCase in file.cases {
      #expect(
        severityForPercent(testCase.input).rawValue == testCase.expected,
        "\(testCase.name) (\(testCase.input))"
      )
    }
  }
}
