import Foundation

/// Sample readings for the settings preview before any real reading lands,
/// and for tests. Mirrors
/// `DEMO_SNAPSHOTS` in `@capsule/config`: the menu bar in the reference HUD
/// reads Thu 27 Aug 11.22, local time.
public enum Demo {
  public static var now: Date { localDate(2026, 8, 27, 11, 22) }

  public static var snapshots: [UsageSnapshot] {
    let now = now
    let fetched = isoString(now)
    let session = isoString(now.addingTimeInterval(51 * 60))
    let weekly = isoString(localDate(2026, 9, 3, 0, 0))
    let codex = isoString(now.addingTimeInterval(5 * 3600))
    let grok = isoString(now.addingTimeInterval(7 * 3600))
    func snapshot(_ id: ProviderId, _ percent: Double, _ buckets: [UsageBucket]) -> UsageSnapshot {
      UsageSnapshot(
        providerId: id, displayName: ProviderLabels.label(id), iconId: id,
        primaryPercent: percent, buckets: buckets, status: .ok, fetchedAt: fetched
      )
    }
    return [
      snapshot(
        .claude, 73,
        [
          UsageBucket(id: "current-session", label: Copy.currentSession, percentUsed: 73, resetsAt: session, resetStyle: .relative),
          UsageBucket(id: "all-models", label: Copy.allModels, percentUsed: 7, resetsAt: weekly, resetStyle: .absolute),
        ]
      ),
      snapshot(
        .codex, 21,
        [
          UsageBucket(id: "primary", label: Copy.fiveHourWindow, percentUsed: 21, resetsAt: codex, resetStyle: .relative),
          UsageBucket(id: "secondary", label: Copy.weeklyWindow, percentUsed: 8, resetsAt: weekly, resetStyle: .absolute),
        ]
      ),
      snapshot(
        .grok, 52,
        [
          UsageBucket(id: "weekly", label: Copy.grokWeekly, percentUsed: 52, resetsAt: grok, resetStyle: .relative),
          UsageBucket(id: "build", label: Copy.grokBuild, percentUsed: 18, resetsAt: weekly, resetStyle: .absolute),
        ]
      ),
    ]
  }

  private static func localDate(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int) -> Date {
    var parts = DateComponents()
    (parts.year, parts.month, parts.day, parts.hour, parts.minute) = (y, mo, d, h, mi)
    return Calendar(identifier: .gregorian).date(from: parts) ?? Date(timeIntervalSince1970: 0)
  }
}
