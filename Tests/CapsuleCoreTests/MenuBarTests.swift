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
    var settings = CapsuleSettings.defaults
    settings.pinnedMetrics = [MetricKey(.claude, "session")]
    #expect(menuBarEntries(settings, readings).isEmpty)
  }

  @Test func figuresFollowTheDockOrderWithTheShorterWindowOnTop() {
    var settings = CapsuleSettings.defaults
    settings.menuBarStyle = .figures
    // Chosen week first, session second, Codex before Claude: drawn in the
    // dock's order, session on top.
    settings.pinnedMetrics = [MetricKey(.codex, "week"), MetricKey(.claude, "week"), MetricKey(.claude, "session")]
    #expect(menuBarEntries(settings, readings) == [one(.claude, 12, 40), one(.codex, 30)])
    settings.usageDisplay = .remaining
    #expect(menuBarEntries(settings, readings).last == MenuBarEntry(provider: .codex, values: [MenuBarValue(percent: 70, used: 30)]))
  }

  @Test func aThirdFigureReplacesTheOldestOfThatProvider() {
    var settings = CapsuleSettings.defaults
    settings.toggleFigure(MetricKey(.claude, "a"), true)
    settings.toggleFigure(MetricKey(.codex, "x"), true)
    settings.toggleFigure(MetricKey(.claude, "b"), true)
    settings.toggleFigure(MetricKey(.claude, "c"), true)
    #expect(settings.pinnedMetrics == [MetricKey(.codex, "x"), MetricKey(.claude, "b"), MetricKey(.claude, "c")])
    settings.toggleFigure(MetricKey(.claude, "b"), false)
    #expect(settings.pinnedMetrics == [MetricKey(.codex, "x"), MetricKey(.claude, "c")])
  }

  @Test func choosingFiguresStartsFromTheBusiestSessionAndWeek() {
    var settings = CapsuleSettings.defaults
    settings.seedFigures(readings)
    #expect(settings.pinnedMetrics == [MetricKey(MeterId(.claude, account: "w"), "session")])
    settings.pinnedMetrics = [MetricKey(.codex, "week")]
    settings.seedFigures(readings)
    #expect(settings.pinnedMetrics == [MetricKey(.codex, "week")])
  }

  @Test func theEdgeDockAloneHasNoMenuBarItem() {
    #expect(!Presence.dock.showsMenuBarItem && Presence.dock.showsDock)
    #expect(Presence.menuBar.showsMenuBarItem && !Presence.menuBar.showsDock)
    #expect(Presence.both.showsMenuBarItem && Presence.both.showsDock)
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
    settings.menuBarStyle = .figures
    settings.pinnedMetrics = [MetricKey(.claude, "current-session")]
    settings.pinStyle = .bars
    settings.dockRings = .sessionAndWeek
    settings.dockPercent = true
    settings.meterStyle = .gauges
    let data = try #require(settings.documentData)
    #expect(CapsuleSettings.read(data: data) == settings)

    let defaults = try #require(CapsuleSettings.defaults.documentData)
    var raw = try #require(JSONValue.parse(String(decoding: defaults, as: UTF8.self))?.asObject)
    for key in ["presence", "menuBarStyle", "dockRings", "pinnedMetrics", "pinStyle", "dockPercent", "meterStyle"] {
      raw[key] = nil
    }
    raw["presence"] = .string("somewhere-new")
    let read = try #require(CapsuleSettings.read(.object(raw)))
    #expect(read.presence == .dock && read.menuBarStyle == .icon && read.pinnedMetrics.isEmpty && read.dockRings == .single)
    #expect(!read.dockPercent && read.meterStyle == .rings)
  }
}
