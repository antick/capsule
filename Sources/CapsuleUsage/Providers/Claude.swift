import CapsuleCore
import Foundation

public struct ClaudeWindow: Sendable, Codable, Equatable {
  @Lenient public var utilization: Double?
  @Lenient public var resets_at: String?
}

public struct ClaudeUsagePayload: Sendable, Codable, Equatable {
  @Lenient public var five_hour: ClaudeWindow?
  @Lenient public var seven_day: ClaudeWindow?
}

/// One window, or nothing. No utilization is not zero utilization: a window
/// Anthropic did not report has no bar to draw, and drawing it at 0% invents a
/// reading the response never carried.
private func windowBucket(
  _ window: ClaudeWindow?,
  id: String,
  label: String,
  resetStyle: ResetStyle,
  fetchedAt: Date
) -> UsageBucket? {
  guard let utilization = window?.utilization, utilization.isFinite else {
    return nil
  }
  return UsageBucket(
    id: id,
    label: label,
    percentUsed: toPercent(utilization),
    resetsAt: window?.resets_at ?? isoString(fetchedAt),
    resetStyle: resetStyle
  )
}

public func mapClaudeUsage(
  _ payload: ClaudeUsagePayload,
  fetchedAt: Date
) -> UsageSnapshot {
  let buckets = [
    windowBucket(
      payload.five_hour, id: "current-session", label: Copy.currentSession,
      resetStyle: .relative, fetchedAt: fetchedAt
    ),
    windowBucket(
      payload.seven_day, id: "all-models", label: Copy.allModels,
      resetStyle: .absolute, fetchedAt: fetchedAt
    ),
  ].compactMap { $0 }

  return UsageSnapshot(
    providerId: .claude,
    displayName: ProviderLabels.label(.claude),
    iconId: .claude,
    // The session window is the headline when it is there; the weekly one
    // stands in when it is not. Neither means we have no reading at all.
    primaryPercent: buckets.first?.percentUsed,
    buckets: buckets,
    // A 200 carrying no window told us nothing. Calling that "ok" would
    // publish the nothing over the last good numbers; "error" keeps them.
    status: buckets.isEmpty ? .error : .ok,
    fetchedAt: isoString(fetchedAt)
  )
}

/// The usage Claude Code already cached in `~/.claude.json`, used when a live
/// read is refused.
public func claudeUsageFromCache(_ raw: String) -> ClaudeUsagePayload? {
  guard let data = raw.data(using: .utf8) else { return nil }
  struct Envelope: Decodable {
    struct Cache: Codable, Sendable, Equatable {
      @Lenient var utilization: ClaudeUsagePayload?
      @Lenient var five_hour: ClaudeWindow?
      @Lenient var seven_day: ClaudeWindow?
    }
    @Lenient var cachedUsageUtilization: Cache?
  }
  guard
    let envelope = try? JSONDecoder().decode(Envelope.self, from: data),
    let cache = envelope.cachedUsageUtilization
  else { return nil }

  let payload =
    cache.utilization
    ?? ClaudeUsagePayload(five_hour: cache.five_hour, seven_day: cache.seven_day)
  guard payload.five_hour != nil || payload.seven_day != nil else { return nil }
  return payload
}

/// A cache whose windows have all rolled over says nothing about today's usage.
public func claudeWindowIsCurrent(_ window: ClaudeWindow?, now: Date) -> Bool {
  guard let raw = window?.resets_at, let resetsAt = looseDate(raw) else {
    return false
  }
  return resetsAt > now
}
