import CapsuleCore
import Foundation
import Testing

@Suite("The menu-bar item")
struct MenuBarTests {
  func snapshot(_ meter: MeterId, _ buckets: [(String, Double)]) -> UsageSnapshot {
    UsageSnapshot(
      providerId: meter.provider, displayName: "x", iconId: meter.provider, primaryPercent: buckets.first?.1,
      buckets: buckets.map { UsageBucket(id: $0.0, label: $0.0, percentUsed: $0.1, resetsAt: "", resetStyle: .relative) },
      status: .ok, fetchedAt: "", accountId: meter.account
    )
  }

  var readings: [UsageSnapshot] {
    [
      snapshot(.claude, [("session", 12.4), ("week", 40)]),
      snapshot(MeterId(.claude, account: "w"), [("session", 61)]),
      snapshot(.codex, [("primary", 30)]),
    ]
  }

  @Test func theIconStyleDrawsNoEntries() {
    #expect(menuBarEntries(.defaults, readings).isEmpty)
  }

  @Test func singleShowsTheHighestUnlessOneIsChosen() {
    var settings = CapsuleSettings.defaults
    settings.menuBarStyle = .single
    #expect(menuBarEntries(settings, readings) == [MenuBarEntry(provider: .claude, percent: 61, used: 61)])
    settings.menuBarMeter = "codex"
    #expect(menuBarEntries(settings, readings) == [MenuBarEntry(provider: .codex, percent: 30, used: 30)])
    settings.usageDisplay = .remaining
    #expect(menuBarEntries(settings, readings) == [MenuBarEntry(provider: .codex, percent: 70, used: 30)])
  }

  @Test func pinnedShowsEachPinInOrderAndSkipsGoneOnes() {
    var settings = CapsuleSettings.defaults
    settings.menuBarStyle = .pinned
    settings.pinnedMetrics = [
      MetricKey(.codex, "primary"), MetricKey(.claude, "week"), MetricKey(.grok, "weekly"),
      MetricKey(MeterId(.claude, account: "w"), "gone"),
    ]
    #expect(
      menuBarEntries(settings, readings) == [
        MenuBarEntry(provider: .codex, percent: 30, used: 30),
        MenuBarEntry(provider: .claude, percent: 40, used: 40),
        MenuBarEntry(provider: .claude, percent: nil, used: nil),
      ])
  }

  @Test func metricKeysRoundTripTheirText() {
    let key = MetricKey(MeterId(.claude, account: "ab12"), "weekly-fable")
    #expect(key.rawValue == "claude:ab12/weekly-fable")
    #expect(MetricKey(rawValue: key.rawValue) == key)
    #expect(MetricKey(rawValue: "nonsense") == nil)
  }

  @Test func theMenuBarSettingsRoundTripAndDefault() throws {
    var settings = CapsuleSettings.defaults
    settings.presence = .both
    settings.menuBarStyle = .pinned
    settings.menuBarMeter = "codex"
    settings.pinnedMetrics = [MetricKey(.claude, "current-session")]
    settings.pinStyle = .bars
    let data = try #require(settings.documentData)
    #expect(CapsuleSettings.read(data: data) == settings)

    let defaults = try #require(CapsuleSettings.defaults.documentData)
    var raw = try #require(JSONValue.parse(String(decoding: defaults, as: UTF8.self))?.asObject)
    for key in ["presence", "menuBarStyle", "menuBarMeter", "pinnedMetrics", "pinStyle"] { raw[key] = nil }
    raw["presence"] = .string("somewhere-new")
    let read = try #require(CapsuleSettings.read(.object(raw)))
    #expect(read.presence == .dock && read.menuBarStyle == .icon && read.pinnedMetrics.isEmpty)
  }
}
