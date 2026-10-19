import CapsuleCore
import Foundation
import Testing

@Suite("The menu-bar item")
struct MenuBarTests {
  /// Windows by id, with lengths the menu bar can tell apart.
  func snapshot(_ meter: MeterId, _ buckets: [(String, Double)]) -> UsageSnapshot {
    UsageSnapshot(
      providerId: meter.provider, displayName: "x", iconId: meter.provider, primaryPercent: buckets.first?.1,
      buckets: buckets.map {
        UsageBucket(
          id: $0.0, label: $0.0, percentUsed: $0.1, resetsAt: "", resetStyle: .relative,
          windowSeconds: $0.0 == "session" ? WindowLengths.fiveHours : WindowLengths.week)
      },
      status: .ok, fetchedAt: "", accountId: meter.account
    )
  }

  func one(_ provider: ProviderId, _ values: Double?...) -> MenuBarEntry {
    MenuBarEntry(provider: provider, values: values.map { MenuBarValue(percent: $0, used: $0) })
  }

  var readings: [UsageSnapshot] {
    [
      snapshot(.claude, [("session", 12.4), ("week", 40)]),
      snapshot(MeterId(.claude, account: "w"), [("session", 61)]),
      snapshot(.codex, [("week", 30)]),
    ]
  }

  @Test func theIconStyleDrawsNoEntries() {
    #expect(menuBarEntries(.defaults, readings).isEmpty)
  }

  @Test func oneProviderShowsItsSessionAndWeekTogether() {
    var settings = CapsuleSettings.defaults
    settings.menuBarStyle = .single
    #expect(menuBarEntries(settings, readings) == [one(.claude, 61)])
    settings.menuBarMeter = "claude"
    #expect(menuBarEntries(settings, readings) == [one(.claude, 12, 40)])
    settings.menuBarMeter = "codex"
    settings.usageDisplay = .remaining
    #expect(menuBarEntries(settings, readings) == [MenuBarEntry(provider: .codex, values: [MenuBarValue(percent: 70, used: 30)])])
  }

  @Test func pinnedShowsEachPinInOrderAndSkipsGoneOnes() {
    var settings = CapsuleSettings.defaults
    settings.menuBarStyle = .pinned
    settings.pinnedMetrics = [
      MetricKey(.codex, "week"), MetricKey(.claude, "week"), MetricKey(.grok, "weekly"),
      MetricKey(MeterId(.claude, account: "w"), "gone"),
    ]
    #expect(menuBarEntries(settings, readings) == [one(.codex, 30), one(.claude, 40), one(.claude, nil)])
    // Two pins of one meter share its mark.
    settings.pinnedMetrics = [MetricKey(.claude, "session"), MetricKey(.codex, "week"), MetricKey(.claude, "week")]
    #expect(menuBarEntries(settings, readings) == [one(.claude, 12, 40), one(.codex, 30)])
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
