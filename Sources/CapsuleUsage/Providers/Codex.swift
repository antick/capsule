import CapsuleCore
import Foundation

public struct CodexWindow: Sendable, Codable, Equatable {
  @Lenient public var used_percent: Double?
  @Lenient public var utilization: Double?
  @Lenient public var limit_window_seconds: Double?
  @Lenient public var reset_at: NumberOrString?
  @Lenient public var reset_after_seconds: Double?
  @Lenient public var resets_at: String?
  @Lenient public var label: String?
}

/// The account's Codex credits, which do not reset.
public struct CodexCredits: Sendable, Codable, Equatable {
  @Lenient public var has_credits: Bool?
  @Lenient public var unlimited: Bool?
  @Lenient public var balance: NumberOrString?
}

public struct CodexUsagePayload: Sendable, Codable, Equatable {
  @Lenient public var credits: CodexCredits?
  public struct RateLimit: Sendable, Codable, Equatable {
    @Lenient public var primary_window: CodexWindow?
    @Lenient public var secondary_window: CodexWindow?
    @Lenient public var primary: CodexWindow?
    @Lenient public var secondary: CodexWindow?
  }
  @Lenient public var plan_type: String?
  @Lenient public var rate_limit: RateLimit?
  @Lenient public var primary_window: CodexWindow?
  @Lenient public var secondary_window: CodexWindow?
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
    fetchedAt: isoString(fetchedAt),
    extras: codexCredits(payload.credits).map { [$0] }
  )
}

/// The credit balance, with what it is worth at Codex's own rate. No credits
/// object, or one saying the account has none and no balance, shows nothing.
func codexCredits(_ credits: CodexCredits?) -> UsageExtra? {
  guard let credits else { return nil }
  if credits.unlimited == true {
    return UsageExtra(id: "credits", label: Copy.codexCredits, value: Copy.unlimited)
  }
  let balance: Double?
  switch credits.balance {
  case .number(let value): balance = value
  case .string(let text): balance = Double(jsTrim(text))
  case nil: balance = nil
  }
  guard let balance, balance.isFinite else { return nil }
  let whole = max(0, balance.rounded(.down))
  return UsageExtra(
    id: "credits", label: Copy.codexCredits,
    value: "\(formatWhole(whole)) \(Copy.credits) · \(formatMoney(whole * UsageEndpoints.Codex.dollarsPerCredit))")
}
