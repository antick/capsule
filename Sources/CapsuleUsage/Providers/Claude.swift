import CapsuleCore
import Foundation

public struct ClaudeWindow: Sendable, Codable, Equatable {
  @Lenient public var utilization: Double?
  @Lenient public var resets_at: String?
}

/// One of the limits Anthropic lists for the account: the session, the
/// all-models week, and any week scoped to a single model.
public struct ClaudeLimit: Sendable, Codable, Equatable {
  public struct Scope: Sendable, Codable, Equatable {
    public struct Model: Sendable, Codable, Equatable {
      @Lenient public var display_name: String?
    }
    @Lenient public var model: Model?
  }
  @Lenient public var kind: String?
  @Lenient public var percent: Double?
  @Lenient public var resets_at: String?
  @Lenient public var scope: Scope?
}

/// Paid usage beyond the plan. Amounts are in cents.
public struct ClaudeExtraUsage: Sendable, Codable, Equatable {
  @Lenient public var is_enabled: Bool?
  @Lenient public var monthly_limit: Double?
  @Lenient public var monthly_credit_limit: Double?
  @Lenient public var used_credits: Double?
  @Lenient public var currency: String?
}

public struct ClaudeUsagePayload: Sendable, Codable, Equatable {
  @Lenient public var five_hour: ClaudeWindow?
  @Lenient public var seven_day: ClaudeWindow?
  @LossyArray public var limits: [ClaudeLimit]?
  @Lenient public var extra_usage: ClaudeExtraUsage?

  public init(five_hour: ClaudeWindow? = nil, seven_day: ClaudeWindow? = nil, limits: [ClaudeLimit]? = nil) {
    self.five_hour = five_hour
    self.seven_day = seven_day
    self.limits = limits
  }
}

/// Every limit the account has, in Anthropic's order, as rows: the session,
/// all models for the week, then each model's own weekly limit by its name.
/// Kinds this build does not know are left out rather than guessed at, and
/// the card's row budget caps how many show.
private func limitBuckets(_ limits: [ClaudeLimit]?) -> [UsageBucket] {
  var rows: [UsageBucket] = []
  for limit in limits ?? [] {
    guard let percent = limit.percent, percent.isFinite, let resetsAt = limit.resets_at else { continue }
    let row: (id: String, label: String, style: ResetStyle)
    switch limit.kind {
    case "session": row = ("current-session", Copy.currentSession, .relative)
    case "weekly_all": row = ("all-models", Copy.allModels, .absolute)
    case "weekly_scoped":
      guard let model = limit.scope?.model?.display_name, !model.isEmpty else { continue }
      row = ("weekly-\(model.lowercased())", model, .absolute)
    default: continue
    }
    guard !rows.contains(where: { $0.id == row.id }) else { continue }
    rows.append(
      UsageBucket(id: row.id, label: row.label, percentUsed: clampPercent(percent), resetsAt: resetsAt, resetStyle: row.style)
    )
  }
  return Array(rows.prefix(HudLimits.maxCardBuckets))
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
  // The list of limits when Anthropic sends one, so a model's own weekly
  // limit shows too; otherwise the two windows every response has carried.
  let listed = limitBuckets(payload.limits)
  let buckets =
    !listed.isEmpty
    ? listed
    : [
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
    fetchedAt: isoString(fetchedAt),
    extras: claudeExtraUsage(payload.extra_usage, fetchedAt: fetchedAt).map { [$0] }
  )
}

/// Extra usage, when the account has it switched on: spend against the
/// monthly cap, or spend alone when there is no cap. Anthropic gives no
/// reset, so the cap is taken to start again on the first of the month, UTC.
func claudeExtraUsage(_ extra: ClaudeExtraUsage?, fetchedAt: Date) -> UsageExtra? {
  guard let extra, extra.is_enabled == true else { return nil }
  let currency = extra.currency.map(jsTrim).flatMap { $0.isEmpty ? nil : $0 } ?? MoneyDefaults.currency
  let used = max(0, (extra.used_credits ?? 0) / 100)
  let resets = isoString(startOfNextMonthUTC(after: fetchedAt))
  if let cents = extra.monthly_limit ?? extra.monthly_credit_limit, cents > 0 {
    let limit = cents / 100
    return UsageExtra(
      id: "extra-usage", label: Copy.extraUsage,
      value: "\(formatMoney(used, currency: currency)) \(Copy.of) \(formatMoney(limit, currency: currency))",
      percentUsed: clampPercent(used / limit * 100), resetsAt: resets)
  }
  return UsageExtra(
    id: "extra-usage", label: Copy.extraUsage, value: "\(formatMoney(used, currency: currency)) \(Copy.spent)",
    resetsAt: resets)
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
