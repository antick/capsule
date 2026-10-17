import CapsuleCore
import CapsuleFixtures
import Testing

@Suite("Session summary and ordering, against the shared corpus")
struct ActivitySummaryTests {
  @Test("summarizeActivity")
  func summarize() throws {
    let file: FixtureFile<[AgentSession]?, ActivitySummary?> = try Fixtures.load(
      "activity/summarize"
    )
    for testCase in file.cases {
      #expect(summarizeActivity(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("orderSessions")
  func order() throws {
    let file: FixtureFile<[AgentSession], [AgentSession]> = try Fixtures.load(
      "activity/order-sessions"
    )
    for testCase in file.cases {
      #expect(orderSessions(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("anyAgentActive")
  func anyActive() throws {
    let file: FixtureFile<[ProviderId: [AgentSession]], Bool> = try Fixtures.load(
      "activity/any-active"
    )
    for testCase in file.cases {
      #expect(anyAgentActive(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }
}
