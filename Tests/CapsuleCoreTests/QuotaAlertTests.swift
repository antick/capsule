import CapsuleCore
import Foundation
import Testing

@Suite("Quota alerts")
struct QuotaAlertTests {
  func reading(_ used: Double, resets: String = "2027-01-20T00:00:00Z") -> [UsageSnapshot] {
    [
      UsageSnapshot(
        providerId: .claude, displayName: "Claude", iconId: .claude, primaryPercent: used,
        buckets: [UsageBucket(id: "all-models", label: Copy.allModels, percentUsed: used, resetsAt: resets, resetStyle: .absolute)],
        status: .ok, fetchedAt: "")
    ]
  }

  @Test func launchIsABaselineAndACrossingWarnsOnce() {
    var state: [String: QuotaWindowState] = [:]
    var result = evaluateQuotaAlerts(reading(70), thresholds: [50, 20], state: state)
    #expect(result.alerts.isEmpty)  // 30% left at launch: already below 50, already told.
    state = result.state
    result = evaluateQuotaAlerts(reading(85), thresholds: [50, 20], state: state)
    #expect(result.alerts.map(\.kind) == [.low(threshold: 20)])
    #expect(result.alerts.first?.body == "15% left. Passed your warning at 20%.")
    state = result.state
    #expect(evaluateQuotaAlerts(reading(90), thresholds: [50, 20], state: state).alerts.isEmpty)
  }

  @Test func jumpingPastTwoThresholdsIsOneAlert() {
    let start = evaluateQuotaAlerts(reading(10), thresholds: [50, 20], state: [:]).state
    let result = evaluateQuotaAlerts(reading(90), thresholds: [50, 20], state: start)
    #expect(result.alerts.map(\.kind) == [.low(threshold: 20)])
    // Recovering re-arms both.
    let recovered = evaluateQuotaAlerts(reading(10), thresholds: [50, 20], state: result.state).state
    #expect(evaluateQuotaAlerts(reading(55), thresholds: [50, 20], state: recovered).alerts.map(\.kind) == [.low(threshold: 50)])
  }

  @Test func aResetIsAnnouncedOncePerWindow() {
    let busy = evaluateQuotaAlerts(reading(60), thresholds: [50], state: [:]).state
    let reset = evaluateQuotaAlerts(reading(0, resets: "2027-01-27T00:00:00Z"), thresholds: [50], state: busy)
    #expect(reset.alerts.map(\.kind) == [.reset])
    #expect(reset.alerts.first?.weekly == true)
    let again = evaluateQuotaAlerts(reading(0.5, resets: "2027-01-27T00:00:00Z"), thresholds: [50], state: reset.state)
    #expect(again.alerts.isEmpty)
  }
}
