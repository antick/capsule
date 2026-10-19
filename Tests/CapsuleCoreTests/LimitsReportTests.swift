import CapsuleCore
import Foundation
import Testing

@Suite("The command line's report")
struct LimitsReportTests {
  @Test func everyMeterHasOneShapeWithNullsWhereNothingIsKnown() throws {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    let snapshot = UsageSnapshot(
      providerId: .codex, displayName: "Codex", iconId: .codex, primaryPercent: nil,
      buckets: [UsageBucket(id: "primary", label: "Weekly", percentUsed: 40, resetsAt: "x", resetStyle: .absolute)],
      status: .ok, fetchedAt: "f", extras: [UsageExtra(id: "credits", label: "Credits", value: "10 credits")])
    let data = try JSONEncoder().encode(limitsReport([snapshot], source: "cache", now: now))
    let json = try #require(JSONValue.parse(String(decoding: data, as: UTF8.self)))
    let meter = try #require(json["meters"]?.asArray?.first)
    #expect(meter["account"] == .null && meter["percentUsed"] == .null)
    #expect(meter["windows"]?.asArray?.first?["percentLeft"]?.asDouble == 60)
    #expect(meter["windows"]?.asArray?.first?["paceDelta"] == .null)
    #expect(meter["amounts"]?.asArray?.first?["value"]?.asString == "10 credits")
    #expect(json["source"]?.asString == "cache")
  }
}
