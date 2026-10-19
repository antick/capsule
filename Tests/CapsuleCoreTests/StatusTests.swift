import CapsuleCore
import Foundation
import Testing

@Suite("Provider status pages")
struct StatusTests {
  let now = Date(timeIntervalSince1970: 1_800_000_000)

  @Test func aStatuspageIndicatorBecomesALevel() throws {
    let ok = try #require(parseStatuspage(#"{"status":{"indicator":"none","description":"All Systems Operational"}}"#, checkedAt: now))
    #expect(ok.level == .none)
    let bad = try #require(parseStatuspage(#"{"status":{"indicator":"major","description":"Partial Outage"}}"#, checkedAt: now))
    #expect(bad.level == .major && bad.level.isOutage)
    #expect(parseStatuspage("<html>", checkedAt: now) == nil)
  }

  @Test func googleIncidentsPickTheWorstOpenOneForTheProduct() throws {
    let feed = #"""
      [{"end":null,"status_impact":"SERVICE_INFORMATION","external_desc":"Slow","currently_affected_products":[{"id":"P"}]},
       {"end":null,"status_impact":"SERVICE_OUTAGE","external_desc":"Down","affected_products":[{"id":"P"}]},
       {"end":"2027-01-01T00:00:00Z","status_impact":"SERVICE_OUTAGE","external_desc":"Old","affected_products":[{"id":"P"}]},
       {"end":null,"status_impact":"SERVICE_OUTAGE","external_desc":"Other","affected_products":[{"id":"Q"}]}]
      """#
    let status = try #require(parseGoogleIncidents(feed, product: "P", checkedAt: now))
    #expect(status.level == .critical && status.description == "Down")
    #expect(parseGoogleIncidents("[]", product: "P", checkedAt: now)?.level == StatusLevel.none)
  }

  @Test func onlyProvidersWithAPageAreChecked() {
    #expect(StatusSource.of(.claude) != nil && StatusSource.of(.antigravity) != nil)
    #expect(StatusSource.of(.deepseek) == nil && StatusSource.of(.grok) == nil)
  }
}
