import CapsuleCore
@testable import CapsuleUsage
import Foundation
import Testing

@Suite("Amounts beyond the percentage windows")
struct ExtrasTests {
  let now = Date(timeIntervalSince1970: 1_800_000_000)  // 2027-01-15

  func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
  }

  @Test func claudeExtraUsageAgainstACap() throws {
    let payload = try decode(
      ClaudeUsagePayload.self,
      #"{"five_hour":{"utilization":10,"resets_at":"2027-01-15T12:00:00Z"},"extra_usage":{"is_enabled":true,"monthly_limit":5000,"used_credits":1240,"currency":"USD"}}"#
    )
    let extra = try #require(mapClaudeUsage(payload, fetchedAt: now).extras?.first)
    #expect(extra.value == "$12.40 of $50.00")
    #expect(extra.percentUsed == 24.8)
    #expect(extra.resetsAt.flatMap(looseDate) == startOfNextMonthUTC(after: now))
  }

  @Test func claudeExtraUsageWithoutACapAndSwitchedOff() throws {
    let open = try decode(ClaudeUsagePayload.self, #"{"extra_usage":{"is_enabled":true,"used_credits":300}}"#)
    #expect(claudeExtraUsage(open.extra_usage, fetchedAt: now)?.value == "$3.00 spent")
    #expect(claudeExtraUsage(open.extra_usage, fetchedAt: now)?.percentUsed == nil)
    let off = try decode(ClaudeUsagePayload.self, #"{"extra_usage":{"is_enabled":false,"used_credits":300}}"#)
    #expect(claudeExtraUsage(off.extra_usage, fetchedAt: now) == nil)
  }

  @Test func codexCreditsAsNumberStringOrUnlimited() throws {
    func credits(_ json: String) throws -> UsageExtra? {
      codexCredits(try decode(CodexUsagePayload.self, json).credits)
    }
    #expect(try credits(#"{"credits":{"has_credits":true,"balance":821.7}}"#)?.value == "821 credits · $32.84")
    #expect(try credits(#"{"credits":{"has_credits":true,"balance":"1250"}}"#)?.value == "1,250 credits · $50.00")
    #expect(try credits(#"{"credits":{"unlimited":true}}"#)?.value == "Unlimited")
    #expect(try credits(#"{"credits":{"has_credits":false}}"#) == nil)
    #expect(try credits(#"{}"#) == nil)
  }

  @Test func theNextMonthStartsAtMidnightUTC() {
    let december = Date(timeIntervalSince1970: 1_797_000_000)  // 2026-12-11
    #expect(isoString(startOfNextMonthUTC(after: december)) == "2027-01-01T00:00:00.000Z")
  }

  @Test func aSessionThatHasNotStartedStaysAsARow() throws {
    let payload = try decode(
      ClaudeUsagePayload.self,
      #"{"limits":[{"kind":"session","percent":0,"resets_at":null},{"kind":"weekly_all","percent":5,"resets_at":"2027-01-20T14:00:00Z"}]}"#
    )
    let snapshot = mapClaudeUsage(payload, fetchedAt: now)
    #expect(snapshot.buckets.map(\.id) == ["current-session", "all-models"])
    #expect(snapshot.buckets.first?.hasStarted == false)
    #expect(snapshot.buckets.last?.hasStarted == true)
  }
}
