import CapsuleCore
import CapsuleUsage
import Foundation
import Testing

@Suite("Cursor's detail beyond the period")
struct CursorDetailTests {
  let now = Date(timeIntervalSince1970: 1_800_000_000)
  func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
  }

  @Test func onDemandAgainstItsLimitOrAlone() throws {
    let capped = try decode(CursorSpendLimit.self, #"{"individualLimit":2000,"individualUsed":550}"#)
    let extra = try #require(cursorOnDemand(capped, resetsAt: "2027-02-01T00:00:00Z"))
    #expect(extra.value == "$5.50 of $20.00")
    #expect(abs((extra.percentUsed ?? 0) - 27.5) < 0.0001)
    let open = try decode(CursorSpendLimit.self, #"{"totalSpend":1234}"#)
    #expect(cursorOnDemand(open, resetsAt: "")?.value == "$12.34 spent")
    #expect(cursorOnDemand(try decode(CursorSpendLimit.self, "{}"), resetsAt: "") == nil)
  }

  @Test func creditsAddGrantsAndHeldStripeCredit() throws {
    let grants = try decode(CursorCreditGrants.self, #"{"hasCreditGrants":true,"totalCents":"5000","usedCents":1000}"#)
    let stripe = try decode(CursorStripe.self, #"{"customerBalance":-2000}"#)
    let extra = try #require(cursorCredits(grants, stripe: stripe))
    #expect(extra.value == "$60.00 left")
    #expect(cursorCredits(nil, stripe: try decode(CursorStripe.self, #"{"customerBalance":500}"#)) == nil)
    #expect(cursorCredits(nil, stripe: stripe)?.value == "$20.00 left")
  }

  @Test func grokBotUnlessItHasNoAllowance() throws {
    let live = try decode(
      CursorGrokBot.self, #"{"usagePercent":42,"nextResetTimestampUtc":"2027-01-20T00:00:00Z","hasNonZeroIncludedLimit":true}"#)
    #expect(cursorGrokBot(live, fetchedAt: now)?.percentUsed == 42)
    let none = try decode(CursorGrokBot.self, #"{"usagePercent":0,"includedLimitZero":true}"#)
    #expect(cursorGrokBot(none, fetchedAt: now) == nil)
  }

  @Test func requestsOnARequestBasedPlan() throws {
    let usage = try decode(
      CursorRequests.self, #"{"gpt-4":{"numRequests":120,"maxRequestUsage":500},"startOfMonth":"2027-01-01T00:00:00Z"}"#)
    let row = try #require(cursorRequestRow(usage, fetchedAt: now))
    #expect(row.percentUsed == 24)
    #expect(row.label == "Requests · 120/500")
    #expect(cursorRequestRow(try decode(CursorRequests.self, "{}"), fetchedAt: now) == nil)
  }
}
