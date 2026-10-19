import CapsuleCore
import Foundation
import Testing

@Suite("Pace")
struct PaceTests {
  let now = Date(timeIntervalSince1970: 1_800_000_000)

  func bucket(_ label: String, used: Double, resetsIn: TimeInterval) -> UsageBucket {
    UsageBucket(
      id: "x", label: label, percentUsed: used, resetsAt: isoString(now.addingTimeInterval(resetsIn)),
      resetStyle: .relative)
  }

  @Test func halfwayThroughAWeekAtHalfIsOnPace() throws {
    let result = try #require(pace(.claude, bucket(Copy.allModels, used: 49, resetsIn: WindowLengths.week / 2), now: now))
    #expect(result.stage == .onTrack)
    #expect(abs(result.elapsedFraction - 0.5) < 0.0001)
    #expect(result.runsOutAt == nil)
    #expect(formatPace(result, now: now).pace == "On pace")
  }

  @Test func aheadOfPaceRunsOutBeforeTheReset() throws {
    // Two of five hours gone, 80% used: 40 points ahead, out in 30 minutes.
    let result = try #require(
      pace(.claude, bucket(Copy.currentSession, used: 80, resetsIn: 3 * WindowLengths.hour), now: now))
    #expect(result.stage == .farAhead)
    #expect(result.runsOutAt == now.addingTimeInterval(30 * 60))
    #expect(formatPace(result, now: now) == ("40% in deficit", "Runs out in 30 min"))
  }

  @Test func behindPaceIsInReserve() throws {
    let result = try #require(pace(.codex, bucket(Copy.weeklyWindow, used: 10, resetsIn: WindowLengths.week / 2), now: now))
    #expect(result.stage == .farBehind)
    #expect(formatPace(result, now: now).pace == "40% in reserve")
  }

  @Test func unknownWindowsAndTooEarlyAreNotJudged() {
    #expect(pace(.grok, bucket("Mystery", used: 50, resetsIn: 100), now: now) == nil)
    #expect(pace(.claude, bucket(Copy.currentSession, used: 5, resetsIn: WindowLengths.fiveHours - 60), now: now) == nil)
    #expect(pace(.claude, bucket(Copy.currentSession, used: 5, resetsIn: -10), now: now) == nil)
  }

  @Test func aFlippedResetReadsTheOtherWay() {
    let soon = now.addingTimeInterval(3 * WindowLengths.day + 4 * WindowLengths.hour)
    #expect(formatResetCopy(soon, style: .absolute, flipped: true, now: now) == "Resets in 3d 4h")
    #expect(formatResetCopy(soon, style: .relative, flipped: false, now: now).hasPrefix("Resets "))
    #expect(formatSpan(90 * 60) == "1h 30 min")
  }
}

@Suite("Arranging a card's rows")
struct MetricLayoutTests {
  var snapshot: UsageSnapshot {
    UsageSnapshot(
      providerId: .claude, displayName: "Claude", iconId: .claude, primaryPercent: 10,
      buckets: ["a", "b", "c", "d"].enumerated().map {
        UsageBucket(id: $1, label: $1, percentUsed: Double($0 * 10 + 10), resetsAt: "", resetStyle: .relative)
      },
      status: .ok, fetchedAt: "")
  }

  @Test func hiddenGoStarredLeadAndTheRingFollowsTheTopRow() {
    var settings = CapsuleSettings.defaults
    settings.setHidden(MetricKey(.claude, "b"), true)
    settings.setStarred(MetricKey(.claude, "d"), true)
    let arranged = arrangeBuckets(snapshot, settings)
    #expect(arranged.buckets.map(\.id) == ["d", "a", "c"])
    #expect(arranged.primaryPercent == 40)
  }

  @Test func movingWritesAStableOrder() {
    var settings = CapsuleSettings.defaults
    settings.moveMetric(MetricKey(.claude, "c"), by: -2, among: ["a", "b", "c", "d"])
    #expect(arrangeBuckets(snapshot, settings).buckets.map(\.id) == ["c", "a", "b", "d"])
    settings.moveMetric(MetricKey(.claude, "a"), by: 5, among: ["a", "b", "c", "d"])
    #expect(arrangeBuckets(snapshot, settings).buckets.map(\.id) == ["c", "b", "d", "a"])
  }

  @Test func theNewSettingsRoundTripAndDefault() throws {
    var settings = CapsuleSettings.defaults
    settings.setHidden(MetricKey(.codex, "primary"), true)
    settings.setStarred(MetricKey(.claude, "all-models"), true)
    settings.moveMetric(MetricKey(.claude, "all-models"), by: -1, among: ["current-session", "all-models"])
    settings.flipResetStyle = true
    settings.showPace = false
    let data = try #require(settings.documentData)
    #expect(CapsuleSettings.read(data: data) == settings)
    #expect(CapsuleSettings.defaults.showPace && !CapsuleSettings.defaults.flipResetStyle)
  }
}
