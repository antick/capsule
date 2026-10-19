import CapsuleCore
import CapsuleUsage
import Foundation
import Testing

@Suite("Antigravity, Devin, OpenRouter, DeepSeek and the Claude API credit")
struct NewProviderTests {
  let now = Date(timeIntervalSince1970: 1_800_000_000)
  func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
  }

  @Test func antigravityGroupsBecomeWindows() throws {
    let quota = try decode(
      AntigravityQuota.self,
      #"{"response":{"groups":[{"displayName":"Gemini Models","buckets":[{"bucketId":"gemini-5h","remainingFraction":0.75,"resetTime":"2027-01-15T10:00:00Z"},{"bucketId":"gemini-weekly","remaining":{"remainingFraction":0.4},"resetTime":"2027-01-20T00:00:00Z","window":"weekly"}]},{"displayName":"Claude and GPT models","buckets":[{"bucketId":"3p-5h","resetTime":"2027-01-15T10:00:00Z"},{"bucketId":"3p-weekly","remainingFraction":1,"disabled":true}]}]}}"#
    )
    let snapshot = mapAntigravity(quota, now: now)
    #expect(snapshot.buckets.map(\.label) == ["Gemini · 5-hour window", "Gemini · Weekly"])
    #expect(snapshot.buckets.map(\.percentUsed) == [25, 60])
    #expect(snapshot.primaryPercent == 60)
  }

  @Test func devinReportsWhatIsLeft() throws {
    let status = try decode(
      DevinStatus.self,
      #"{"userStatus":{"planStatus":{"dailyQuotaRemainingPercent":70,"weeklyQuotaRemainingPercent":"bad","weeklyQuotaResetAtUnix":1800300000,"dailyQuotaResetAtUnix":"1800030000","overageBalanceMicros":"2500000"}}}"#
    )
    let snapshot = mapDevin(status, now: now)
    #expect(snapshot.buckets.map(\.percentUsed) == [30, 100])
    #expect(snapshot.extras?.first?.value == "$2.50 left")
  }

  @Test func openRouterBalanceLimitAndSpend() throws {
    let credits = try decode(OpenRouterCredits.self, #"{"data":{"total_credits":50,"total_usage":12.5}}"#)
    let key = try decode(
      OpenRouterKey.self, #"{"data":{"limit":20,"limit_remaining":15,"usage_daily":1.2,"usage_weekly":4,"usage_monthly":12.5}}"#)
    let snapshot = mapOpenRouter(credits, key, now: now)
    #expect(snapshot.extras?.map(\.value) == [
      "$37.50 left of $50.00", "$5.00 of $20.00", "Today $1.20 · Week $4.00 · Month $12.50",
    ])
    #expect(snapshot.primaryPercent == 25)
  }

  @Test func deepSeekPrefersDollarsAndSplitsTheBalance() throws {
    let balance = try decode(
      DeepSeekBalance.self,
      #"{"is_available":true,"balance_infos":[{"currency":"CNY","total_balance":"100"},{"currency":"USD","total_balance":"50.00","granted_balance":"10.00","topped_up_balance":"40.00"}]}"#
    )
    #expect(mapDeepSeek(balance, now: now).extras?.first?.value == "$50.00 (paid $40.00 · granted $10.00)")
  }

  @Test func theMaxPlanCreditIsTheSoonestGrantStillRunning() throws {
    let credits = try decode(
      ClaudeConsoleCredits.self,
      #"{"currency":"USD","balance":{"credits":{"exponent":2}},"promo_tranches":[{"program_id":"subscription_api_credit","granted_amount_minor_units":20000,"remaining_amount_minor_units":12475,"expires_at":"2027-01-28T00:00:00Z"},{"program_id":"subscription_api_credit","granted_amount_minor_units":20000,"remaining_amount_minor_units":20000,"expires_at":"2027-02-28T00:00:00Z"},{"program_id":"other","granted_amount_minor_units":500,"remaining_amount_minor_units":500}]}"#
    )
    let extra = try #require(claudeSubscriptionCredit(credits, now: now))
    #expect(extra.value == "$124.75 left of $200.00")
    #expect(extra.resetsAt == "2027-01-28T00:00:00Z")
  }
}
