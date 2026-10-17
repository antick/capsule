import CapsuleCore
import Foundation

/// A placeholder per provider, in the dock's order. Nothing enabled still
/// draws the default set, or the dock would vanish with no way back to it.
public func placeholderSnapshots(_ ids: [ProviderId], now: Date) -> [UsageSnapshot] {
  (ids.isEmpty ? SettingsDefaults.enabledProviderIds : ids).map {
    UsageSnapshot(
      providerId: $0, displayName: ProviderLabels.label($0), iconId: $0,
      primaryPercent: nil, buckets: [], status: .unauthenticated, fetchedAt: isoString(now)
    )
  }
}

/// What to show at launch: each enabled provider's remembered reading, dated
/// and marked stale so it never passes for live, or a placeholder where
/// nothing useful was remembered.
public func rememberedSnapshots(
  _ enabled: [ProviderId], _ remembered: [UsageSnapshot], now: Date
) -> [UsageSnapshot] {
  placeholderSnapshots(enabled, now: now).map { placeholder in
    guard let old = remembered.first(where: { $0.providerId == placeholder.providerId }),
      old.status == .ok || old.status == .stale, !old.buckets.isEmpty
    else { return placeholder }
    var shown = old
    shown.status = .stale
    shown.staleSince = old.staleSince ?? old.fetchedAt
    shown.refreshing = false
    return shown
  }
}

/// Poll at full rate while an agent is working; otherwise wait out the idle
/// interval.
public func shouldRefresh(
  busy: Bool, sinceLastAttemptMs: Double, idleIntervalMs: Double = PollerTuning.idleIntervalMs
) -> Bool {
  busy || sinceLastAttemptMs >= idleIntervalMs
}
