import CapsuleCore
import Testing

@Suite("Adaptive refresh")
struct AdaptiveRefreshTests {
  let minute = 60_000.0

  @Test func theWaitFollowsTheMacAndTheUser() {
    func delay(_ since: Double?, busy: Bool = false, constrained: Bool = false) -> Double {
      AdaptiveRefresh.delayMs(sinceInteractionMs: since, busy: busy, constrained: constrained, intervalMs: minute)
    }
    #expect(delay(0, busy: true, constrained: true) == 30 * minute)
    #expect(delay(nil, busy: true) == minute)
    #expect(delay(2 * minute) == 2 * minute)
    #expect(delay(30 * minute) == 5 * minute)
    #expect(delay(2 * 60 * minute) == 15 * minute)
    #expect(delay(5 * 60 * minute) == 30 * minute)
    #expect(delay(nil) == 30 * minute)
  }
}
