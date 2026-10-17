import CapsuleCore
import Foundation

public struct CopilotQuota: Sendable, Codable, Equatable {
  @Lenient public var percent_remaining: Double?
  @Lenient public var unlimited: Bool?
}

public struct CopilotUser: Sendable, Codable, Equatable {
  public struct Snapshots: Sendable, Codable, Equatable {
    @Lenient public var premium_interactions: CopilotQuota?
    @Lenient public var chat: CopilotQuota?
  }
  @Lenient public var quota_snapshots: Snapshots?
  @Lenient public var quota_reset_date: String?
}

/// Copilot's own login file: one entry per GitHub host, each with a token.
///
/// The original takes the first entry in document order. A Swift dictionary
/// does not preserve that order, so with several hosts signed in this could
/// pick a different one. Harmless in practice — there is one host — but it is
/// the reason to reach for an ordered decode if that ever stops being true.
public func copilotTokenFromApps(_ raw: String) -> String? {
  guard let data = raw.data(using: .utf8) else { return nil }
  struct Entry: Decodable { var oauth_token: String? }
  guard
    let parsed = try? JSONDecoder().decode([String: Entry].self, from: data)
  else { return nil }
  for key in parsed.keys.sorted() {
    if let token = parsed[key]?.oauth_token, !token.isEmpty { return token }
  }
  return nil
}

/// An unlimited quota has no percentage to show, and inventing one lies.
private func quotaBucket(
  id: String,
  label: String,
  quota: CopilotQuota?,
  resetsAt: String
) -> UsageBucket? {
  guard let quota, quota.unlimited != true,
    let remaining = quota.percent_remaining, remaining.isFinite
  else { return nil }
  return UsageBucket(
    id: id,
    label: label,
    // Copilot reports what is left; Capsule shows what is used.
    percentUsed: toPercent(100 - remaining),
    resetsAt: resetsAt,
    resetStyle: .absolute
  )
}

public func mapCopilotUsage(
  _ payload: CopilotUser,
  fetchedAt: Date
) -> UsageSnapshot {
  let resetsAt = resetIso(
    payload.quota_reset_date.map(NumberOrString.string), fallback: fetchedAt
  )
  let buckets = [
    quotaBucket(
      id: "premium", label: Copy.copilotPremium,
      quota: payload.quota_snapshots?.premium_interactions, resetsAt: resetsAt
    ),
    quotaBucket(
      id: "chat", label: Copy.copilotChat,
      quota: payload.quota_snapshots?.chat, resetsAt: resetsAt
    ),
  ].compactMap { $0 }

  return UsageSnapshot(
    providerId: .copilot,
    displayName: ProviderLabels.label(.copilot),
    iconId: .copilot,
    primaryPercent: buckets.first?.percentUsed,
    buckets: buckets,
    status: .ok,
    fetchedAt: isoString(fetchedAt)
  )
}
