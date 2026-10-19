import CapsuleCore
import Foundation

/// A placeholder per meter, in the dock's order. Nothing enabled still
/// draws the default set, or the dock would vanish with no way back to it.
public func placeholderSnapshots(
  _ meters: [MeterId], now: Date, label: (MeterId) -> String = { ProviderLabels.label($0.provider) }
) -> [UsageSnapshot] {
  (meters.isEmpty ? SettingsDefaults.enabledProviderIds.map { MeterId($0) } : meters).map {
    UsageSnapshot(
      providerId: $0.provider, displayName: label($0), iconId: $0.provider,
      primaryPercent: nil, buckets: [], status: .unauthenticated, fetchedAt: isoString(now),
      accountId: $0.account
    )
  }
}

public func placeholderSnapshots(_ ids: [ProviderId], now: Date) -> [UsageSnapshot] {
  placeholderSnapshots(ids.map { MeterId($0) }, now: now)
}

/// What to show at launch: each enabled provider's remembered reading, dated
/// and marked stale so it never passes for live, or a placeholder where
/// nothing useful was remembered.
public func rememberedSnapshots(
  _ enabled: [MeterId], _ remembered: [UsageSnapshot], now: Date,
  label: (MeterId) -> String = { ProviderLabels.label($0.provider) }
) -> [UsageSnapshot] {
  placeholderSnapshots(enabled, now: now, label: label).map { placeholder in
    guard let old = remembered.first(where: { $0.meterId == placeholder.meterId }),
      old.status == .ok || old.status == .stale, !old.buckets.isEmpty
    else { return placeholder }
    var shown = old
    shown.displayName = placeholder.displayName
    shown.status = .stale
    shown.staleSince = old.staleSince ?? old.fetchedAt
    shown.refreshing = false
    return shown
  }
}

public func rememberedSnapshots(
  _ enabled: [ProviderId], _ remembered: [UsageSnapshot], now: Date
) -> [UsageSnapshot] {
  rememberedSnapshots(enabled.map { MeterId($0) }, remembered, now: now)
}

/// Poll at full rate while an agent is working; otherwise wait out the idle
/// interval.
public func shouldRefresh(
  busy: Bool, sinceLastAttemptMs: Double, idleIntervalMs: Double = PollerTuning.idleIntervalMs
) -> Bool {
  busy || sinceLastAttemptMs >= idleIntervalMs
}
