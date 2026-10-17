import CapsuleCore
import Foundation

public struct CodexWindow: Sendable, Codable, Equatable {
  public var used_percent: Double?
  public var utilization: Double?
  public var limit_window_seconds: Double?
  public var reset_at: NumberOrString?
  public var reset_after_seconds: Double?
  public var resets_at: String?
  public var label: String?
}

public struct CodexUsagePayload: Sendable, Codable, Equatable {
  public struct RateLimit: Sendable, Codable, Equatable {
    public var primary_window: CodexWindow?
    public var secondary_window: CodexWindow?
    public var primary: CodexWindow?
    public var secondary: CodexWindow?
  }
  public var plan_type: String?
  public var rate_limit: RateLimit?
  public var primary_window: CodexWindow?
  public var secondary_window: CodexWindow?
}

/// What the window says it has used, or nothing. A window Codex did not report
/// — or reported without a percentage — has no bar to draw, and drawing it at
/// 0% invents a reading the response never carried.
private func windowPercent(_ window: CodexWindow?) -> Double? {
  guard let used = window?.used_percent ?? window?.utilization, used.isFinite
  else { return nil }
  return toPercent(used)
}

private func mapWindow(
  _ window: CodexWindow?,
  id: String,
  fallbackLabel: String,
  fetchedAt: Date
) -> UsageBucket? {
  guard let window, let percentUsed = windowPercent(window) else { return nil }

  let fallback =
    window.reset_after_seconds.map {
      fetchedAt.addingTimeInterval($0)
    } ?? fetchedAt
  let named = window.reset_at ?? window.resets_at.map(NumberOrString.string)
  let seconds = window.limit_window_seconds
  // A window that rolls within a day reads as a countdown; a longer one reads
  // as a date.
  let relative = seconds != nil && seconds! <= 24 * 3600

  return UsageBucket(
    id: id,
    label: window.label ?? windowLabel(seconds: seconds, fallback: fallbackLabel),
    percentUsed: percentUsed,
    resetsAt: resetIso(named, fallback: fallback),
    resetStyle: relative ? .relative : .absolute
  )
}

public func mapCodexUsage(
  _ payload: CodexUsagePayload,
  fetchedAt: Date
) -> UsageSnapshot {
  let rate = payload.rate_limit
  let primary = rate?.primary_window ?? rate?.primary ?? payload.primary_window
  let secondary =
    rate?.secondary_window ?? rate?.secondary ?? payload.secondary_window

  let buckets = [
    mapWindow(
      primary, id: "primary", fallbackLabel: Copy.fiveHourWindow,
      fetchedAt: fetchedAt
    ),
    mapWindow(
      secondary, id: "secondary", fallbackLabel: Copy.weeklyWindow,
      fetchedAt: fetchedAt
    ),
  ].compactMap { $0 }

  return UsageSnapshot(
    providerId: .codex,
    displayName: ProviderLabels.label(.codex),
    iconId: .codex,
    primaryPercent: buckets.first?.percentUsed,
    buckets: buckets,
    // A 200 carrying no window told us nothing. Calling that "ok" would
    // publish the nothing over the last good numbers; "error" keeps them.
    status: buckets.isEmpty ? .error : .ok,
    fetchedAt: isoString(fetchedAt)
  )
}
