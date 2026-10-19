import CapsuleCore
import Foundation
import Testing

@Suite("Usage history")
struct HistoryTests {
  func reading(_ used: Double) -> [UsageSnapshot] {
    [
      UsageSnapshot(
        providerId: .codex, displayName: "Codex", iconId: .codex, primaryPercent: used,
        buckets: [UsageBucket(id: "primary", label: "Weekly", percentUsed: used, resetsAt: "", resetStyle: .absolute)],
        status: .ok, fetchedAt: "")
    ]
  }
  let start = Date(timeIntervalSince1970: 1_800_000_000)
  let key = MetricKey(.codex, "primary").rawValue

  @Test func keepsMovesAndAnHourlyHeartbeat() {
    var history = recordHistory([:], reading(10), now: start)
    history = recordHistory(history, reading(10.4), now: start.addingTimeInterval(60))  // too small, too soon
    history = recordHistory(history, reading(12), now: start.addingTimeInterval(120))  // moved
    history = recordHistory(history, reading(12), now: start.addingTimeInterval(1_800))  // unchanged
    history = recordHistory(history, reading(12), now: start.addingTimeInterval(120 + 3_600))  // heartbeat
    #expect(history[key]?.map(\.percent) == [10, 12, 12])
  }

  @Test func forgetsWhatIsTooOld() {
    var history = recordHistory([:], reading(10), now: start)
    history = recordHistory(history, reading(20), now: start.addingTimeInterval(HistoryTuning.keepSeconds + 1))
    #expect(history[key]?.map(\.percent) == [20])
    #expect(chartSamples(history, MetricKey(.codex, "primary"), now: start.addingTimeInterval(HistoryTuning.keepSeconds + 1)).count == 1)
  }

  @Test func chartsThinLongHistoriesButKeepTheLatest() {
    let many = (0..<1_000).map { UsageSample(at: start.timeIntervalSince1970 - Double(1_000 - $0) * 60, percent: Double($0 % 100)) }
    let shown = chartSamples([key: many], MetricKey(.codex, "primary"), now: start)
    #expect(shown.count == HistoryTuning.maxChartPoints)
    #expect(shown.first == many.first && shown.last == many.last)
  }

  @Test func chartDaysReadShort() {
    #expect(formatChartDay(start, timeZone: TimeZone(identifier: "UTC")!) == "Fri 15")
  }
}
